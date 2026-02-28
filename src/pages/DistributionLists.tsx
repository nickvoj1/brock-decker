import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import {
  DistributionListContact,
  DistributionListSummary,
  createDistributionList,
  deleteDistributionList,
  listDistributionListContacts,
  listDistributionLists,
  removeContactsFromDistributionList,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";
const PAGE_SIZE = 25;

function formatValue(value: unknown): string {
  const output = String(value ?? "").trim();
  return output || "-";
}

export default function DistributionLists() {
  const profileName = useProfileName();
  const navigate = useNavigate();

  const [lists, setLists] = useState<DistributionListSummary[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [contacts, setContacts] = useState<DistributionListContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsOffset, setContactsOffset] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsAppending, setContactsAppending] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [deleteListLoading, setDeleteListLoading] = useState(false);
  const [removeContactsLoading, setRemoveContactsLoading] = useState(false);

  useEffect(() => {
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
    }
  }, [navigate, profileName]);

  const loadLists = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setListsLoading(true);
    try {
      const result = await listDistributionLists(ADMIN_PROFILE);
      if (result.success && Array.isArray(result.data)) {
        setLists(result.data);
      } else if (!options.silent) {
        toast.error(result.error || "Failed to load distribution lists");
      }
    } catch {
      if (!options.silent) toast.error("Failed to load distribution lists");
    } finally {
      if (!options.silent) setListsLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async (
    listId: string,
    options: {
      reset?: boolean;
      append?: boolean;
      offset?: number;
      search?: string;
      silent?: boolean;
    } = {},
  ) => {
    if (!listId) {
      setContacts([]);
      setContactsTotal(0);
      setContactsOffset(0);
      return;
    }

    const isReset = Boolean(options.reset);
    if (options.append) {
      setContactsAppending(true);
    } else if (!options.silent) {
      setContactsLoading(true);
    }

    try {
      const offset = isReset ? 0 : options.offset ?? contactsOffset;
      const search = options.search ?? searchValue;
      const result = await listDistributionListContacts(ADMIN_PROFILE, listId, {
        limit: PAGE_SIZE,
        offset,
        search,
      });

      if (!result.success || !result.data) {
        if (!options.silent) {
          toast.error(result.error || "Failed to load distribution list contacts");
        }
        return;
      }

      const batch = result.data.contacts || [];
      if (isReset) {
        setContacts(batch);
      } else {
        setContacts((prev) => {
          const seen = new Set(prev.map((row) => `${row.list_id}:${row.bullhorn_id}`));
          const merged = [...prev];
          for (const row of batch) {
            const key = `${row.list_id}:${row.bullhorn_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(row);
          }
          return merged;
        });
      }

      setContactsTotal(Number(result.data.total || 0));
      setContactsOffset(offset + batch.length);
    } catch {
      if (!options.silent) toast.error("Failed to load distribution list contacts");
    } finally {
      if (options.append) {
        setContactsAppending(false);
      } else if (!options.silent) {
        setContactsLoading(false);
      }
    }
  }, [contactsOffset, searchValue]);

  useEffect(() => {
    if (profileName === ADMIN_PROFILE) {
      void loadLists();
    }
  }, [loadLists, profileName]);

  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    if (!selectedListId) return;
    setSelectedContactIds(new Set());
    void loadContacts(selectedListId, { reset: true, search: searchValue });
  }, [loadContacts, searchValue, selectedListId]);

  const selectedList = useMemo(
    () => lists.find((item) => item.id === selectedListId) || null,
    [lists, selectedListId],
  );

  const hasMore = contacts.length < contactsTotal;
  const allLoadedSelected = contacts.length > 0 && contacts.every((row) => selectedContactIds.has(row.bullhorn_id));
  const partiallySelected = !allLoadedSelected && contacts.some((row) => selectedContactIds.has(row.bullhorn_id));

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) {
      toast.error("Enter a distribution list name");
      return;
    }

    setCreateLoading(true);
    try {
      const result = await createDistributionList(ADMIN_PROFILE, name);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create distribution list");
        return;
      }

      setNewListName("");
      toast.success("Distribution list created");
      await loadLists({ silent: true });
      setSelectedListId(result.data.id);
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleSelectAllLoaded = (checked: boolean | "indeterminate") => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (checked !== false) {
        contacts.forEach((row) => next.add(row.bullhorn_id));
      } else {
        contacts.forEach((row) => next.delete(row.bullhorn_id));
      }
      return next;
    });
  };

  const toggleSelectContact = (bullhornId: number, checked: boolean | "indeterminate") => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (checked !== false) {
        next.add(bullhornId);
      } else {
        next.delete(bullhornId);
      }
      return next;
    });
  };

  const handleDeleteSelectedList = async () => {
    if (!selectedList) {
      toast.error("Select a distribution list first");
      return;
    }

    const confirmed = window.confirm(
      `Delete list "${selectedList.name}"? This removes only list membership, not CRM contacts.`,
    );
    if (!confirmed) return;

    setDeleteListLoading(true);
    try {
      const result = await deleteDistributionList(ADMIN_PROFILE, selectedList.id);
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to delete distribution list");
        return;
      }

      const remaining = lists.filter((list) => list.id !== selectedList.id);
      setLists(remaining);
      const nextSelectedId = remaining[0]?.id || "";
      setSelectedListId(nextSelectedId);
      if (!nextSelectedId) {
        setContacts([]);
        setContactsTotal(0);
        setContactsOffset(0);
      }
      setSelectedContactIds(new Set());

      toast.success(
        `Deleted "${selectedList.name}" (${Number(result.data.removedContacts || 0)} memberships removed)`,
      );
      await loadLists({ silent: true });
    } finally {
      setDeleteListLoading(false);
    }
  };

  const handleRemoveSelectedContacts = async () => {
    if (!selectedListId) {
      toast.error("Select a distribution list first");
      return;
    }

    if (selectedContactIds.size === 0) {
      toast.error("Select at least one contact");
      return;
    }

    const selectedCount = selectedContactIds.size;
    const confirmed = window.confirm(
      `Remove ${selectedCount} contact${selectedCount === 1 ? "" : "s"} from this list? CRM contacts stay unchanged.`,
    );
    if (!confirmed) return;

    setRemoveContactsLoading(true);
    try {
      const result = await removeContactsFromDistributionList(
        ADMIN_PROFILE,
        selectedListId,
        Array.from(selectedContactIds),
      );
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to remove contacts from distribution list");
        return;
      }

      setSelectedContactIds(new Set());
      await loadLists({ silent: true });
      await loadContacts(selectedListId, { reset: true, search: searchValue, silent: true });

      const removed = Number(result.data.removed || 0);
      const skipped = Number(result.data.skipped || 0);
      toast.success(
        skipped > 0
          ? `Removed ${removed} contact${removed === 1 ? "" : "s"} (${skipped} already absent)`
          : `Removed ${removed} contact${removed === 1 ? "" : "s"} from list`,
      );
    } finally {
      setRemoveContactsLoading(false);
    }
  };

  if (profileName !== ADMIN_PROFILE) {
    return null;
  }

  return (
    <AppLayout title="Distribution Lists" description="CRM distribution list workspace">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lists</CardTitle>
            <CardDescription>Create and manage saved contact lists</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New distribution list"
              />
              <Button onClick={handleCreateList} disabled={createLoading}>
                {createLoading ? "Creating..." : "Create"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {lists.length} list{lists.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => loadLists()} disabled={listsLoading}>
                  <RefreshCw className={`h-4 w-4 ${listsLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={handleDeleteSelectedList}
                  disabled={!selectedListId || deleteListLoading}
                  title="Delete selected list"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">No distribution lists yet.</p>
              ) : (
                lists.map((list) => {
                  const active = list.id === selectedListId;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
                      }`}
                      onClick={() => setSelectedListId(list.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{list.name}</p>
                        <Badge variant="outline">{list.contact_count}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Created by {list.created_by}</p>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{selectedList?.name || "Select a distribution list"}</CardTitle>
                <CardDescription>
                  {selectedList
                    ? `${contactsTotal.toLocaleString()} contact${contactsTotal === 1 ? "" : "s"}`
                    : "Choose a list from the left panel"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="w-[260px]"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Search by name, email, company"
                />
                <Button variant="outline" onClick={() => setSearchValue(searchDraft.trim())}>Search</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchDraft("");
                    setSearchValue("");
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRemoveSelectedContacts}
                  disabled={!selectedListId || selectedContactIds.size === 0 || removeContactsLoading}
                >
                  <UserMinus className="mr-1.5 h-4 w-4" />
                  {removeContactsLoading
                    ? "Removing..."
                    : `Remove Selected (${selectedContactIds.size})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedListId ? (
              <p className="text-sm text-muted-foreground">Select a distribution list to view contacts.</p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[44px]">
                          <Checkbox
                            checked={allLoadedSelected ? true : partiallySelected ? "indeterminate" : false}
                            onCheckedChange={toggleSelectAllLoaded}
                            aria-label="Select all loaded contacts"
                          />
                        </TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Loading contacts...</TableCell>
                        </TableRow>
                      ) : contacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No contacts in this list yet.</TableCell>
                        </TableRow>
                      ) : (
                        contacts.map((contact) => (
                          <TableRow key={`${contact.list_id}:${contact.bullhorn_id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedContactIds.has(contact.bullhorn_id)}
                                onCheckedChange={(checked) => toggleSelectContact(contact.bullhorn_id, checked)}
                                aria-label={`Select contact ${contact.bullhorn_id}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{contact.bullhorn_id}</TableCell>
                            <TableCell>{formatValue(contact.name)}</TableCell>
                            <TableCell>{formatValue(contact.occupation)}</TableCell>
                            <TableCell>{formatValue(contact.company_name)}</TableCell>
                            <TableCell>{formatValue(contact.email)}</TableCell>
                            <TableCell>{new Date(contact.added_at).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {hasMore && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => loadContacts(selectedListId, { append: true, offset: contactsOffset })}
                      disabled={contactsAppending}
                    >
                      {contactsAppending ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
