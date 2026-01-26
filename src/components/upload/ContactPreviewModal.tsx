import { useState, useMemo } from "react";
import { X, Search, Download, ArrowRight, Trash2, Building2, MapPin, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Contact {
  name: string;
  email: string;
  title: string;
  company: string;
  location: string;
}

interface ContactPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  candidateName: string;
  onProceed: (filteredContacts: Contact[]) => void;
  onDownload: (filteredContacts: Contact[]) => void;
}

export function ContactPreviewModal({
  isOpen,
  onClose,
  contacts: initialContacts,
  candidateName,
  onProceed,
  onDownload,
}: ContactPreviewModalProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());

  // Get unique companies for filter dropdown
  const uniqueCompanies = useMemo(() => {
    const companies = new Set(contacts.map((c) => c.company));
    return Array.from(companies).sort();
  }, [contacts]);

  // Filter contacts based on search and company filter
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Exclude removed contacts
      if (excludedEmails.has(contact.email)) return false;

      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchLower) ||
        contact.email.toLowerCase().includes(searchLower) ||
        contact.title.toLowerCase().includes(searchLower) ||
        contact.company.toLowerCase().includes(searchLower) ||
        contact.location.toLowerCase().includes(searchLower);

      // Company filter
      const matchesCompany =
        companyFilter === "all" || contact.company === companyFilter;

      return matchesSearch && matchesCompany;
    });
  }, [contacts, searchQuery, companyFilter, excludedEmails]);

  const handleRemoveContact = (email: string) => {
    setExcludedEmails((prev) => new Set([...prev, email]));
  };

  const handleRestoreAll = () => {
    setExcludedEmails(new Set());
  };

  const activeContacts = contacts.filter((c) => !excludedEmails.has(c.email));
  const removedCount = excludedEmails.size;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Contact Preview
            <Badge variant="secondary" className="ml-2">
              {activeContacts.length} contacts
            </Badge>
            {removedCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {removedCount} removed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review contacts found for <strong>{candidateName}</strong>. Remove
            unwanted contacts or filter to find specific ones.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-3 items-center py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, title, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by company" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">All Companies</SelectItem>
              {uniqueCompanies.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {removedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleRestoreAll}>
              Restore all
            </Button>
          )}
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="w-[200px]">Title</TableHead>
                <TableHead className="w-[180px]">Company</TableHead>
                <TableHead className="w-[200px]">Location</TableHead>
                <TableHead className="w-[220px]">Email</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery || companyFilter !== "all"
                      ? "No contacts match your filters"
                      : "No contacts found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.email} className="group">
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contact.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{contact.company}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="text-sm truncate max-w-[180px]">
                          {contact.location}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-primary">{contact.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveContact(contact.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Stats */}
        <div className="text-sm text-muted-foreground pt-2">
          Showing {filteredContacts.length} of {activeContacts.length} contacts
          {searchQuery && ` matching "${searchQuery}"`}
          {companyFilter !== "all" && ` from ${companyFilter}`}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDownload(activeContacts)}
            disabled={activeContacts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV ({activeContacts.length})
          </Button>
          <Button
            onClick={() => onProceed(activeContacts)}
            disabled={activeContacts.length === 0}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Go to History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
