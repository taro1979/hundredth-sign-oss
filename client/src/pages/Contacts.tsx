import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  UserPlus, Search, Trash2, Edit, User, Building, Mail, Phone,
  ArrowUpDown, ArrowUp, ArrowDown, Tag, LayoutGrid, List,
  ChevronDown, ChevronRight, X, Users, Plus, Settings, Palette,
  FolderPlus, UserMinus,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getLocaleNumber } from "@/lib/locale";

type SortField = "name" | "company" | "email" | "createdAt";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "grid";

// Default category colors
const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444",
  "#06B6D4", "#EC4899", "#6366F1", "#14B8A6", "#F97316",
];

function getCategoryBadgeStyle(color?: string | null) {
  if (!color) return "bg-gray-100 text-gray-600";
  return "";
}

export default function Contacts() {
  const { t, i18n } = useTranslation();
  const sortLocale = getLocaleNumber(i18n.language);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", company: "", department: "", phone: "", notes: "", category: "none", groupIds: [] as number[],
  });
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["__all__"]));

  // Category management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: DEFAULT_COLORS[0] });

  // Group management
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [groupMemberDialogOpen, setGroupMemberDialogOpen] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<number | null>(null);

  // Data queries
  const { data: contacts, isLoading } = trpc.contacts.list.useQuery();
  const { data: categories } = trpc.contactCategories.list.useQuery();
  const { data: groups } = trpc.contactGroups.list.useQuery();
  const utils = trpc.useUtils();

  // Contact mutations
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: async (data) => {
      const { toAdd } = pendingGroupSync.current;
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((gid) => addMemberMutation.mutateAsync({ groupId: gid, contactId: data.id })));
      }
      toast.success(t("contacts.createSuccess"));
      setDialogOpen(false);
      resetForm();
      utils.contacts.list.invalidate();
      utils.contactGroups.members.invalidate();
    },
    onError: () => toast.error(t("contacts.createError")),
  });

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: async (_, variables) => {
      const { toAdd, toRemove } = pendingGroupSync.current;
      await Promise.all([
        ...toAdd.map((gid) => addMemberMutation.mutateAsync({ groupId: gid, contactId: variables.id })),
        ...toRemove.map((gid) => removeMemberMutation.mutateAsync({ groupId: gid, contactId: variables.id })),
      ]);
      toast.success(t("contacts.updateSuccess"));
      setDialogOpen(false);
      setEditingContact(null);
      resetForm();
      utils.contacts.list.invalidate();
      utils.contactGroups.members.invalidate();
    },
    onError: () => toast.error(t("contacts.updateError")),
  });

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.deleteSuccess"));
      utils.contacts.list.invalidate();
    },
    onError: () => toast.error(t("contacts.deleteError")),
  });

  // Category mutations
  const createCategoryMutation = trpc.contactCategories.create.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.categoryCreateSuccess"));
      setCategoryForm({ name: "", color: DEFAULT_COLORS[0] });
      setEditingCategory(null);
      utils.contactCategories.list.invalidate();
    },
    onError: () => toast.error(t("contacts.createError")),
  });

  const updateCategoryMutation = trpc.contactCategories.update.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.categoryUpdateSuccess"));
      setCategoryForm({ name: "", color: DEFAULT_COLORS[0] });
      setEditingCategory(null);
      utils.contactCategories.list.invalidate();
    },
    onError: () => toast.error(t("contacts.updateError")),
  });

  const deleteCategoryMutation = trpc.contactCategories.delete.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.categoryDeleteSuccess"));
      utils.contactCategories.list.invalidate();
    },
    onError: () => toast.error(t("contacts.deleteError")),
  });

  // Group mutations
  const createGroupMutation = trpc.contactGroups.create.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.groupCreateSuccess"));
      setGroupForm({ name: "", description: "" });
      setEditingGroup(null);
      utils.contactGroups.list.invalidate();
    },
    onError: () => toast.error(t("contacts.createError")),
  });

  const updateGroupMutation = trpc.contactGroups.update.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.groupUpdateSuccess"));
      setGroupForm({ name: "", description: "" });
      setEditingGroup(null);
      utils.contactGroups.list.invalidate();
    },
    onError: () => toast.error(t("contacts.updateError")),
  });

  const deleteGroupMutation = trpc.contactGroups.delete.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.groupDeleteSuccess"));
      utils.contactGroups.list.invalidate();
      utils.contactGroups.members.invalidate();
    },
    onError: () => toast.error(t("contacts.deleteError")),
  });

  const addMemberMutation = trpc.contactGroups.addMember.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.addToGroupSuccess"));
      if (selectedGroupForMembers) {
        utils.contactGroups.members.invalidate({ groupId: selectedGroupForMembers });
      }
    },
    onError: () => toast.error(t("contacts.createError")),
  });

  const removeMemberMutation = trpc.contactGroups.removeMember.useMutation({
    onSuccess: () => {
      toast.success(t("contacts.removeFromGroupSuccess"));
      if (selectedGroupForMembers) {
        utils.contactGroups.members.invalidate({ groupId: selectedGroupForMembers });
      }
    },
    onError: () => toast.error(t("contacts.deleteError")),
  });

  // Group members query (conditional)
  const { data: groupMembers } = trpc.contactGroups.members.useQuery(
    { groupId: selectedGroupForMembers! },
    { enabled: !!selectedGroupForMembers }
  );

  const pendingGroupSync = useRef<{ toAdd: number[]; toRemove: number[] }>({ toAdd: [], toRemove: [] });

  const resetForm = () => setForm({ name: "", email: "", company: "", department: "", phone: "", notes: "", category: "none", groupIds: [] });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error(t("contacts.createError"));
      return;
    }
    const { groupIds, ...rest } = form;
    const payload = {
      ...rest,
      notes: rest.notes || undefined,
      category: rest.category === "none" ? undefined : rest.category,
    };
    const originalGroupIds = editingContact
      ? ((contacts || []).find((c) => c.id === editingContact)?.groups ?? []).map((g) => g.id)
      : [];
    pendingGroupSync.current = {
      toAdd: groupIds.filter((id) => !originalGroupIds.includes(id)),
      toRemove: originalGroupIds.filter((id) => !groupIds.includes(id)),
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (contact: NonNullable<typeof contacts>[0]) => {
    setEditingContact(contact.id);
    setForm({
      name: contact.name,
      email: contact.email,
      company: contact.company ?? "",
      department: contact.department ?? "",
      phone: contact.phone ?? "",
      notes: (contact as any).notes ?? "",
      category: (contact as any).category ?? "none",
      groupIds: contact.groups.map((g) => g.id),
    });
    setDialogOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Build category options from user-created categories
  const categoryOptions = useMemo(() => {
    const opts: { value: string; label: string; color: string | null }[] = [
      { value: "none", label: t("common.none"), color: null },
    ];
    if (categories) {
      for (const cat of categories) {
        opts.push({ value: cat.name, label: cat.name, color: cat.color });
      }
    }
    return opts;
  }, [categories]);

  // Filter, sort contacts
  const processedContacts = useMemo(() => {
    if (!contacts) return [];
    let list = [...contacts];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.department ?? "").toLowerCase().includes(q)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "none") {
        list = list.filter(c => !(c as any).category);
      } else {
        list = list.filter(c => (c as any).category === categoryFilter);
      }
    }

    // Group filter
    if (groupFilter !== "all") {
      const gid = Number(groupFilter);
      list = list.filter(c => (c as any).groups?.some((g: any) => g.id === gid));
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name, sortLocale); break;
        case "company": cmp = (a.company ?? "").localeCompare(b.company ?? "", sortLocale); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [contacts, searchQuery, categoryFilter, groupFilter, sortField, sortDir, sortLocale]);

  const bulkDelete = () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(t("contacts.bulkDeleteConfirm", { count: selectedContacts.size }))) return;
    Array.from(selectedContacts).forEach(id => {
      deleteMutation.mutate({ id });
    });
    setSelectedContacts(new Set());
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />;
  };

  const getCategoryForContact = (cat?: string | null) => {
    if (!cat) return null;
    return categoryOptions.find(c => c.value === cat) ?? null;
  };

  // Category management handlers
  const handleCategorySubmit = () => {
    if (!categoryForm.name.trim()) {
      toast.error(t("contacts.createError"));
      return;
    }
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory, name: categoryForm.name, color: categoryForm.color });
    } else {
      createCategoryMutation.mutate({ name: categoryForm.name, color: categoryForm.color });
    }
  };

  const startEditCategory = (cat: NonNullable<typeof categories>[0]) => {
    setEditingCategory(cat.id);
    setCategoryForm({ name: cat.name, color: cat.color || DEFAULT_COLORS[0] });
  };

  // Group management handlers
  const handleGroupSubmit = () => {
    if (!groupForm.name.trim()) {
      toast.error(t("contacts.createError"));
      return;
    }
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup, name: groupForm.name, description: groupForm.description });
    } else {
      createGroupMutation.mutate({ name: groupForm.name, description: groupForm.description });
    }
  };

  const startEditGroup = (grp: NonNullable<typeof groups>[0]) => {
    setEditingGroup(grp.id);
    setGroupForm({ name: grp.name, description: grp.description || "" });
  };

  const groupMemberIds = useMemo(() => {
    if (!groupMembers) return new Set<number>();
    return new Set(groupMembers.map(m => m.contactId));
  }, [groupMembers]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{t("contacts.title")}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {t("contacts.totalCount", { count: contacts?.length ?? 0 })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCategoryDialogOpen(true); setEditingCategory(null); setCategoryForm({ name: "", color: DEFAULT_COLORS[0] }); }}
              >
                <Tag className="w-4 h-4 mr-1.5" />
                {t("contacts.manageCategories")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setGroupDialogOpen(true); setEditingGroup(null); setGroupForm({ name: "", description: "" }); }}
              >
                <Users className="w-4 h-4 mr-1.5" />
                {t("contacts.manageGroups")}
              </Button>
              <Button
                onClick={() => { resetForm(); setEditingContact(null); setDialogOpen(true); }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t("contacts.addContact")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t("contacts.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder={t("contacts.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.allCategories")}</SelectItem>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {(categories || []).map(c => (
                  <SelectItem key={c.id} value={c.name}>
                    <div className="flex items-center gap-2">
                      {c.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />}
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Group Filter */}
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <Users className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder={t("contacts.allGroups")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.allGroups")}</SelectItem>
                {(groups || []).map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 ${viewMode === "table" ? "bg-emerald-50 text-emerald-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 ${viewMode === "grid" ? "bg-emerald-50 text-emerald-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk Actions */}
            {selectedContacts.size > 0 && (
              <Button variant="destructive" size="sm" onClick={bulkDelete} className="h-9">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t("contacts.selectedCount", { count: selectedContacts.size })}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : processedContacts.length === 0 ? (
          <div className="bg-white rounded-lg border py-16 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery || categoryFilter !== "all" ? t("contacts.noResults") : t("contacts.noContacts")}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || categoryFilter !== "all" ? t("contacts.searchPlaceholder") : t("contacts.addContact")}
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={selectedContacts.size === processedContacts.length && processedContacts.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedContacts(new Set(processedContacts.map(c => c.id)));
                        else setSelectedContacts(new Set());
                      }}
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      {t("common.name")} <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort("email")} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      {t("common.email")} <SortIcon field="email" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort("company")} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700">
                      {t("common.company")} <SortIcon field="company" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("contacts.category")}</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("contacts.group")}</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedContacts.map(contact => {
                  const catInfo = getCategoryForContact((contact as any).category);
                  return (
                    <tr key={contact.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedContacts);
                            if (checked) next.add(contact.id); else next.delete(contact.id);
                            setSelectedContacts(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-emerald-700">{contact.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{contact.name}</div>
                            {contact.department && <div className="text-xs text-gray-500">{contact.department}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.company || "—"}</td>
                      <td className="px-4 py-3">
                        {catInfo ? (
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal"
                            style={catInfo.color ? { backgroundColor: `${catInfo.color}20`, color: catInfo.color, borderColor: `${catInfo.color}40` } : undefined}
                          >
                            {catInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(contact as any).groups && (contact as any).groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(contact as any).groups.map((g: any) => (
                              <Badge key={g.id} variant="outline" className="text-xs font-normal border-emerald-300 text-emerald-600 bg-emerald-50">
                                {g.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(contact)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if (confirm(t("contacts.deleteConfirm"))) deleteMutation.mutate({ id: contact.id }); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedContacts.map(contact => {
              const catInfo = getCategoryForContact((contact as any).category);
              return (
                <div key={contact.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-medium text-emerald-700">{contact.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{contact.name}</div>
                        {catInfo && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal mt-0.5"
                            style={catInfo.color ? { backgroundColor: `${catInfo.color}20`, color: catInfo.color, borderColor: `${catInfo.color}40` } : undefined}
                          >
                            {catInfo.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(contact)} className="p-1 text-gray-400 hover:text-emerald-600">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(t("contacts.deleteConfirm"))) deleteMutation.mutate({ id: contact.id }); }} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.company && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{contact.company}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) { setEditingContact(null); resetForm(); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? t("contacts.editContact") : t("contacts.addContact")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("common.name")} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("organization.namePlaceholderFull")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("common.email")} *</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="taro@example.com"
                  type="email"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("common.company")}</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder={t("contacts.companyPlaceholder")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("common.department")}</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder={t("contacts.departmentPlaceholder")}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("common.phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="03-1234-5678"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">{t("contacts.category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {(categories || []).map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        <div className="flex items-center gap-2">
                          {c.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />}
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-500">{t("contacts.group")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between mt-1 font-normal h-9 px-3">
                    <span className="truncate text-sm">
                      {form.groupIds.length === 0
                        ? t("contacts.selectGroups")
                        : form.groupIds.length === 1
                        ? (groups || []).find((g) => g.id === form.groupIds[0])?.name ?? ""
                        : `${form.groupIds.length} ${t("contacts.group")}`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  {(!groups || groups.length === 0) ? (
                    <p className="text-sm text-gray-400 py-2 px-2">{t("contacts.noGroups")}</p>
                  ) : (
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {(groups || []).map((g) => (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={form.groupIds.includes(g.id)}
                            onCheckedChange={(checked) => {
                              setForm((prev) => ({
                                ...prev,
                                groupIds: checked
                                  ? [...prev.groupIds, g.id]
                                  : prev.groupIds.filter((id) => id !== g.id),
                              }));
                            }}
                          />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-500">{t("common.description")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("common.description")}
                rows={2}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {createMutation.isPending || updateMutation.isPending ? t("common.loading") : editingContact ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("contacts.manageCategories")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Existing categories */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("contacts.category")}</Label>
              {(!categories || categories.length === 0) ? (
                <p className="text-sm text-gray-400 py-2">{t("contacts.noResults")}</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50/50 hover:bg-gray-50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 h-4 rounded-full flex-shrink-0 border" style={{ backgroundColor: cat.color || "#9CA3AF" }} />
                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditCategory(cat)}
                          className="p-1 text-gray-400 hover:text-emerald-600 rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t("contacts.deleteConfirm"))) deleteCategoryMutation.mutate({ id: cat.id }); }}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit form */}
            <div className="border-t pt-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {editingCategory ? t("contacts.editContact") : t("contacts.addContact")}
              </Label>
              <div className="flex items-end gap-3 mt-2">
                <div className="flex-1">
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder={t("contacts.categoryPlaceholder")}
                    className="h-9"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-9 h-9 rounded-md border flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: categoryForm.color }}
                    >
                      <Palette className="w-4 h-4 text-white drop-shadow" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="grid grid-cols-5 gap-2">
                      {DEFAULT_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setCategoryForm({ ...categoryForm, color })}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${categoryForm.color === color ? "border-gray-900 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleCategorySubmit}
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  size="sm"
                  className="h-9 bg-emerald-600 hover:bg-emerald-700"
                >
                  {editingCategory ? t("common.save") : t("common.create")}
                </Button>
                {editingCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", color: DEFAULT_COLORS[0] }); }}
                  >
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Management Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("contacts.manageGroups")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Existing groups */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("contacts.group")}</Label>
              {(!groups || groups.length === 0) ? (
                <p className="text-sm text-gray-400 py-2">{t("contacts.noResults")}</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {groups.map(grp => (
                    <div key={grp.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50/50 hover:bg-gray-50">
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <div>
                          <span className="text-sm font-medium text-gray-700">{grp.name}</span>
                          {grp.description && <p className="text-xs text-gray-400">{grp.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedGroupForMembers(grp.id); setGroupMemberDialogOpen(true); }}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title={t("contacts.manageGroups")}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEditGroup(grp)}
                          className="p-1 text-gray-400 hover:text-emerald-600 rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t("contacts.deleteConfirm"))) deleteGroupMutation.mutate({ id: grp.id }); }}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit form */}
            <div className="border-t pt-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {editingGroup ? t("contacts.editContact") : t("contacts.addContact")}
              </Label>
              <div className="space-y-2 mt-2">
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder={t("contacts.groupPlaceholder")}
                  className="h-9"
                />
                <Input
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder={t("contacts.groupDescriptionPlaceholder")}
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleGroupSubmit}
                    disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                    size="sm"
                    className="h-9 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {editingGroup ? t("common.save") : t("common.create")}
                  </Button>
                  {editingGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => { setEditingGroup(null); setGroupForm({ name: "", description: "" }); }}
                    >
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Members Dialog */}
      <Dialog open={groupMemberDialogOpen} onOpenChange={(open) => {
        setGroupMemberDialogOpen(open);
        if (!open) setSelectedGroupForMembers(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {groups?.find(g => g.id === selectedGroupForMembers)?.name || t("contacts.group")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Current members */}
            <div>
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.member")}</Label>
              {(!groupMembers || groupMembers.length === 0) ? (
                <p className="text-sm text-gray-400 py-3">{t("contacts.noContactsInGroup")}</p>
              ) : (
                <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                  {groupMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-emerald-700">{member.contactName?.charAt(0) || "?"}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">{member.contactName}</span>
                          <span className="text-xs text-gray-400 ml-2">{member.contactEmail}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedGroupForMembers) {
                            removeMemberMutation.mutate({ groupId: selectedGroupForMembers, contactId: member.contactId });
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title={t("contacts.removeFromGroup")}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add members */}
            <div className="border-t pt-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("contacts.addContact")}</Label>
              <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                {(contacts || [])
                  .filter(c => !groupMemberIds.has(c.id))
                  .map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">{contact.name.charAt(0)}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-700">{contact.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{contact.email}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (selectedGroupForMembers) {
                            addMemberMutation.mutate({ groupId: selectedGroupForMembers, contactId: contact.id });
                          }
                        }}
                        disabled={addMemberMutation.isPending}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {t("common.create")}
                      </Button>
                    </div>
                  ))}
                {contacts && contacts.length > 0 && contacts.filter(c => !groupMemberIds.has(c.id)).length === 0 && (
                  <p className="text-sm text-gray-400 py-2 text-center">{t("contacts.noResults")}</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
