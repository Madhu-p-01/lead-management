"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import supabase from "../utils/supabase";
import LeadDetailModal from "./LeadDetailModal";
import AssignLeadsModal from "./AssignLeadsModal";
import { useAuth } from "../contexts/AuthContext";

const formatDateForDatabase = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const statusVariants = {
  "Fresh Lead": "border-purple-200 bg-purple-100 text-purple-700",
  Interested: "border-emerald-200 bg-emerald-100 text-emerald-700",
  "Not Interested": "border-gray-200 bg-gray-100 text-gray-600",
  "Follow-up": "border-blue-200 bg-blue-100 text-blue-700",
  default: "border-gray-200 bg-gray-100 text-gray-600",
};

const getStatusClasses = (status) =>
  statusVariants[status] || statusVariants.default;

const LeadList = ({ categoryId, onImportClick }) => {
  const { user, userRole } = useAuth();
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState({});

  // Bulk edit mode
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("updated_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState({
    hasWebsite: "all", // all, yes, no
    hasPhone: "all",
    hasEmail: "all",
    hasOwner: "all",
    hasRating: "all",
    hasFollowUp: "all",
    minRating: "",
    maxRating: "",
    queryFilter: "all",
    assignedToFilter: "all",
  });

  // Unique queries for filter dropdown
  const [uniqueQueries, setUniqueQueries] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setLeads([]);
      setFilteredLeads([]);
      return;
    }
    fetchLeads();
  }, [categoryId]);

  useEffect(() => {
    applyFiltersAndSort();
    // Extract unique queries
    const queries = [
      ...new Set(
        leads.map((lead) => lead.query).filter((q) => q && q !== "null")
      ),
    ];
    setUniqueQueries(queries.sort());
  }, [
    leads,
    searchTerm,
    statusFilter,
    sortField,
    sortDirection,
    advancedFilters,
  ]);

  // Fetch all users for the assigned to filter
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("is_authorized", true)
          .order("email");

        if (!error && data) {
          setAllUsers(data.map((u) => u.email));
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchAllUsers();
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Ensure session is active before making requests
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.error("No active session when fetching leads");
        setErrorMessage("Session expired. Please refresh the page.");
        setIsLoading(false);
        return;
      }

      // Fetch all leads using pagination
      let allLeads = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        // Build query - try with assigned_to first, fallback if column doesn't exist
        let query = supabase
          .from("leads")
          .select(
            `
              id,
              name,
              reviews,
              rating,
              website,
              phone,
              owner_name,
              query,
              status,
              follow_up_date,
              notes,
              created_at,
              updated_at,
              assigned_to,
              lead_categories!inner ( category_id )
            `
          )
          .eq("lead_categories.category_id", Number(categoryId));

        // For regular users, only show their assigned leads
        if (userRole === "user" && user) {
          query = query.eq("assigned_to", user.id);
        }

        // Order by updated_at first (most recently updated at top), then created_at
        let { data, error } = await query
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        // If error is due to missing column, retry without assigned_to
        if (error && error.message && error.message.includes("assigned_to")) {
          console.warn(
            "assigned_to column not found, fetching without it. Please run the database migration."
          );
          query = supabase
            .from("leads")
            .select(
              `
                id,
                name,
                reviews,
                rating,
                website,
                phone,
                owner_name,
                query,
                status,
                follow_up_date,
                notes,
                created_at,
                updated_at,
                lead_categories!inner ( category_id )
              `
            )
            .eq("lead_categories.category_id", Number(categoryId))
            .order("updated_at", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, from + pageSize - 1);

          const result = await query;
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error("Error fetching leads", error);
          setErrorMessage("Unable to load leads for this category right now.");
          setLeads([]);
          setFilteredLeads([]);
          setIsLoading(false);
          return;
        }

        if (data && data.length > 0) {
          allLeads = [...allLeads, ...data];
          from += pageSize;

          // If we got less than pageSize, we've reached the end
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const normalized = allLeads.map((lead) => ({
        ...lead,
        follow_up_date: lead.follow_up_date
          ? new Date(lead.follow_up_date)
          : null,
      }));

      console.log(`Fetched ${normalized.length} leads total`);
      setLeads(normalized);
      setIsLoading(false);
    } catch (error) {
      console.error("Error in fetchLeads:", error);
      setErrorMessage("Unable to load leads. Please refresh the page.");
      setLeads([]);
      setFilteredLeads([]);
      setIsLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...leads];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          lead.phone?.toLowerCase().includes(term) ||
          lead.owner_name?.toLowerCase().includes(term) ||
          lead.website?.toLowerCase().includes(term) ||
          lead.query?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // Advanced filters
    if (advancedFilters.hasWebsite === "yes") {
      filtered = filtered.filter(
        (lead) => lead.website && lead.website.trim() !== ""
      );
    } else if (advancedFilters.hasWebsite === "no") {
      filtered = filtered.filter(
        (lead) => !lead.website || lead.website.trim() === ""
      );
    }

    if (advancedFilters.hasPhone === "yes") {
      filtered = filtered.filter(
        (lead) => lead.phone && lead.phone.trim() !== ""
      );
    } else if (advancedFilters.hasPhone === "no") {
      filtered = filtered.filter(
        (lead) => !lead.phone || lead.phone.trim() === ""
      );
    }

    if (advancedFilters.hasOwner === "yes") {
      filtered = filtered.filter(
        (lead) => lead.owner_name && lead.owner_name.trim() !== ""
      );
    } else if (advancedFilters.hasOwner === "no") {
      filtered = filtered.filter(
        (lead) => !lead.owner_name || lead.owner_name.trim() === ""
      );
    }

    if (advancedFilters.hasRating === "yes") {
      filtered = filtered.filter((lead) => lead.rating && lead.rating > 0);
    } else if (advancedFilters.hasRating === "no") {
      filtered = filtered.filter((lead) => !lead.rating || lead.rating === 0);
    }

    if (advancedFilters.hasFollowUp === "yes") {
      filtered = filtered.filter((lead) => lead.follow_up_date);
    } else if (advancedFilters.hasFollowUp === "no") {
      filtered = filtered.filter((lead) => !lead.follow_up_date);
    }

    // Rating range filter
    if (advancedFilters.minRating) {
      const min = parseFloat(advancedFilters.minRating);
      filtered = filtered.filter((lead) => lead.rating && lead.rating >= min);
    }
    if (advancedFilters.maxRating) {
      const max = parseFloat(advancedFilters.maxRating);
      filtered = filtered.filter((lead) => lead.rating && lead.rating <= max);
    }

    // Query filter
    if (advancedFilters.queryFilter !== "all") {
      filtered = filtered.filter(
        (lead) => lead.query === advancedFilters.queryFilter
      );
    }

    // Assigned To filter
    if (advancedFilters.assignedToFilter !== "all") {
      if (advancedFilters.assignedToFilter === "unassigned") {
        filtered = filtered.filter((lead) => !lead.assigned_user_email);
      } else {
        filtered = filtered.filter(
          (lead) =>
            lead.assigned_user_email === advancedFilters.assignedToFilter
        );
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle dates
      if (sortField === "created_at" || sortField === "updated_at" || sortField === "follow_up_date") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Handle strings
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredLeads(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const updateLead = async (leadId, updates) => {
    setSaving((prev) => ({ ...prev, [leadId]: true }));
    setErrorMessage("");

    const payload = { ...updates, updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(payload, "follow_up_date")) {
      payload.follow_up_date = payload.follow_up_date
        ? formatDateForDatabase(payload.follow_up_date)
        : null;
    }

    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update lead", error);
      setErrorMessage("Failed to update lead. Please try again.");
      setSaving((prev) => ({ ...prev, [leadId]: false }));
      return;
    }

    if (data) {
      // Update the lead in state
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                ...data,
                follow_up_date: data.follow_up_date
                  ? new Date(data.follow_up_date)
                  : null,
              }
            : lead
        )
      );
    }

    setSaving((prev) => ({ ...prev, [leadId]: false }));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleBulkEditMode = () => {
    setIsBulkEditMode(!isBulkEditMode);
    setSelectedLeadIds([]);
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === currentLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(currentLeads.map((lead) => lead.id));
    }
  };

  const handleAssignComplete = async () => {
    // Refresh leads after assignment
    await fetchLeads();
    setSelectedLeadIds([]);
    setIsBulkEditMode(false);
    // Force re-apply filters and sort to ensure updated leads appear at top
    setTimeout(() => {
      applyFiltersAndSort();
    }, 100);
  };

  const getUserEmail = async (userId) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user email:", error);
        return null;
      }
      return data?.email || null;
    } catch (error) {
      console.error("Error in getUserEmail:", error);
      return null;
    }
  };

  // Fetch assigned user emails for leads
  useEffect(() => {
    const fetchAssignedUsers = async () => {
      const leadsWithAssignedTo = leads.filter(
        (lead) => lead.assigned_to && !lead.assigned_user_email
      );
      if (leadsWithAssignedTo.length === 0) return;

      const uniqueUserIds = [
        ...new Set(leadsWithAssignedTo.map((lead) => lead.assigned_to)),
      ];

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("id", uniqueUserIds);

        if (!error && data) {
          const userMap = {};
          data.forEach((user) => {
            userMap[user.id] = user.email;
          });

          setLeads((prevLeads) =>
            prevLeads.map((lead) => ({
              ...lead,
              assigned_user_email:
                lead.assigned_to && !lead.assigned_user_email
                  ? userMap[lead.assigned_to]
                  : lead.assigned_user_email,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching assigned users:", error);
      }
    };

    fetchAssignedUsers();
  }, [leads.length]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return (
        <svg
          className="h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg
        className="h-4 w-4 text-primary-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="h-4 w-4 text-primary-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  if (!categoryId) {
    return (
      <section className="card animate-fade-in flex flex-col items-center justify-center gap-4 border-dashed p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900">
            No Category Selected
          </h3>
          <p className="text-sm text-gray-600">
            Select a category from the sidebar to view its leads.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <svg
            className="h-6 w-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <div className="badge badge-info">
            {filteredLeads.length}{" "}
            {filteredLeads.length === 1 ? "lead" : "leads"}
          </div>
          {selectedLeadIds.length > 0 && (
            <div className="badge badge-primary">
              {selectedLeadIds.length} selected
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedLeadIds.length > 0 && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="btn btn-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Assign
            </button>
          )}
          {(userRole === "admin" || userRole === "superadmin") && (
            <button
              onClick={toggleBulkEditMode}
              className={`btn ${
                isBulkEditMode ? "btn-secondary" : "btn-primary"
              }`}
            >
              {isBulkEditMode ? (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Bulk Edit
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, phone, owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>

        {/* Items per page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show:</span>
          <div className="flex gap-1">
            {[20, 50, 100].map((count) => (
              <button
                key={count}
                onClick={() => setItemsPerPage(count)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  itemsPerPage === count
                    ? "bg-primary-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters Button */}
        <div className="relative">
          <button
            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Filters
            {(statusFilter !== "All" ||
              sortField !== "created_at" ||
              advancedFilters.hasWebsite !== "all" ||
              advancedFilters.hasPhone !== "all" ||
              advancedFilters.hasOwner !== "all" ||
              advancedFilters.hasRating !== "all" ||
              advancedFilters.hasFollowUp !== "all" ||
              advancedFilters.queryFilter !== "all" ||
              advancedFilters.assignedToFilter !== "all" ||
              advancedFilters.minRating ||
              advancedFilters.maxRating) && (
              <span className="flex h-2 w-2 rounded-full bg-primary-600"></span>
            )}
          </button>

          {/* Advanced Filters Modal */}
          {isAdvancedFiltersOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setIsAdvancedFiltersOpen(false)}
              />

              {/* Modal */}
              <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[600px]">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Advanced Filters
                  </h3>
                  <button
                    onClick={() => setIsAdvancedFiltersOpen(false)}
                    className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
                  <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="input w-full"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Fresh Lead">Fresh Lead</option>
                        <option value="Interested">Interested</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>

                    {/* Has Website */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Website
                      </label>
                      <select
                        value={advancedFilters.hasWebsite}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            hasWebsite: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All</option>
                        <option value="yes">With Website</option>
                        <option value="no">Without Website</option>
                      </select>
                    </div>

                    {/* Has Phone */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Phone
                      </label>
                      <select
                        value={advancedFilters.hasPhone}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            hasPhone: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All</option>
                        <option value="yes">With Phone</option>
                        <option value="no">Without Phone</option>
                      </select>
                    </div>

                    {/* Has Owner */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Owner Name
                      </label>
                      <select
                        value={advancedFilters.hasOwner}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            hasOwner: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All</option>
                        <option value="yes">With Owner</option>
                        <option value="no">Without Owner</option>
                      </select>
                    </div>

                    {/* Has Rating */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Rating
                      </label>
                      <select
                        value={advancedFilters.hasRating}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            hasRating: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All</option>
                        <option value="yes">With Rating</option>
                        <option value="no">Without Rating</option>
                      </select>
                    </div>

                    {/* Has Follow-up */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Follow-up Date
                      </label>
                      <select
                        value={advancedFilters.hasFollowUp}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            hasFollowUp: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All</option>
                        <option value="yes">With Follow-up</option>
                        <option value="no">Without Follow-up</option>
                      </select>
                    </div>

                    {/* Query Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Search Query
                      </label>
                      <select
                        value={advancedFilters.queryFilter}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            queryFilter: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All Queries</option>
                        {uniqueQueries.map((query) => (
                          <option key={query} value={query}>
                            {query}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Assigned To Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Assigned To
                      </label>
                      <select
                        value={advancedFilters.assignedToFilter}
                        onChange={(e) =>
                          setAdvancedFilters({
                            ...advancedFilters,
                            assignedToFilter: e.target.value,
                          })
                        }
                        className="input w-full"
                      >
                        <option value="all">All Users</option>
                        <option value="unassigned">Unassigned</option>
                        {allUsers.map((email) => (
                          <option key={email} value={email}>
                            {email}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Rating Range */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Rating Range
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min (e.g., 3.0)"
                          value={advancedFilters.minRating}
                          onChange={(e) =>
                            setAdvancedFilters({
                              ...advancedFilters,
                              minRating: e.target.value,
                            })
                          }
                          min="0"
                          max="5"
                          step="0.1"
                          className="input flex-1"
                        />
                        <span className="flex items-center text-gray-500">
                          to
                        </span>
                        <input
                          type="number"
                          placeholder="Max (e.g., 5.0)"
                          value={advancedFilters.maxRating}
                          onChange={(e) =>
                            setAdvancedFilters({
                              ...advancedFilters,
                              maxRating: e.target.value,
                            })
                          }
                          min="0"
                          max="5"
                          step="0.1"
                          className="input flex-1"
                        />
                      </div>
                    </div>

                    {/* Sort By */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Sort By
                      </label>
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                        className="input w-full"
                      >
                        <option value="updated_at">Last Updated</option>
                        <option value="created_at">Date Added</option>
                        <option value="name">Name</option>
                        <option value="status">Status</option>
                        <option value="rating">Rating</option>
                        <option value="follow_up_date">Follow-up Date</option>
                      </select>
                    </div>

                    {/* Sort Direction */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Order
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSortDirection("asc")}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            sortDirection === "asc"
                              ? "bg-primary-600 text-white"
                              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                            Ascending
                          </div>
                        </button>
                        <button
                          onClick={() => setSortDirection("desc")}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            sortDirection === "desc"
                              ? "bg-primary-600 text-white"
                              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            Descending
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 p-4">
                  <button
                    onClick={() => {
                      setStatusFilter("All");
                      setSortField("updated_at");
                      setSortDirection("desc");
                      setAdvancedFilters({
                        hasWebsite: "all",
                        hasPhone: "all",
                        hasEmail: "all",
                        hasOwner: "all",
                        hasRating: "all",
                        hasFollowUp: "all",
                        queryFilter: "all",
                        assignedToFilter: "all",
                        minRating: "",
                        maxRating: "",
                      });
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Reset All Filters
                  </button>
                  <button
                    onClick={() => setIsAdvancedFiltersOpen(false)}
                    className="btn btn-primary"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error animate-scale-in flex items-start gap-2">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isBulkEditMode && (
                <th className="sticky left-0 z-10 bg-gray-50 w-12 px-2 sm:px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedLeadIds.length === currentLeads.length &&
                      currentLeads.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              <th
                className={`${
                  isBulkEditMode ? "sticky left-12 sm:left-auto sm:static" : "sticky left-0 sm:static"
                } z-10 bg-gray-50 min-w-[200px] sm:w-auto cursor-pointer px-2 sm:px-4 py-3 text-left`}
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="min-w-[140px] sm:w-auto cursor-pointer px-2 sm:px-4 py-3 text-left"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="min-w-[120px] sm:w-auto px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Phone
              </th>
              <th className="min-w-[140px] sm:w-auto px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Owner
              </th>
              <th
                className="min-w-[100px] sm:w-auto cursor-pointer px-2 sm:px-4 py-3 text-left"
                onClick={() => handleSort("rating")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Rating
                  <SortIcon field="rating" />
                </div>
              </th>
              <th
                className="min-w-[140px] sm:w-auto cursor-pointer px-2 sm:px-4 py-3 text-left"
                onClick={() => handleSort("follow_up_date")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Follow-up
                  <SortIcon field="follow_up_date" />
                </div>
              </th>
              <th className="min-w-[140px] sm:w-auto px-2 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Assigned To
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <>
                {[...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    {isBulkEditMode && (
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 rounded bg-gray-200"></div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                        <div className="h-3 w-1/2 rounded bg-gray-100"></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-8 w-32 rounded-lg bg-gray-200"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-gray-200"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 rounded bg-gray-200"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="h-4 w-4 rounded bg-gray-200"></div>
                        <div className="h-4 w-8 rounded bg-gray-200"></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-8 w-32 rounded-lg bg-gray-200"></div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 rounded bg-gray-200"></div>
                    </td>
                  </tr>
                ))}
              </>
            ) : currentLeads.length === 0 ? (
              <tr>
                <td
                  colSpan={isBulkEditMode ? 8 : 7}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  {searchTerm || statusFilter !== "All"
                    ? "No leads match your filters."
                    : "No leads in this category yet."}
                </td>
              </tr>
            ) : (
              currentLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={(e) => {
                    if (isBulkEditMode) {
                      e.stopPropagation();
                      toggleLeadSelection(lead.id);
                    } else {
                      setSelectedLead(lead);
                      setIsModalOpen(true);
                    }
                  }}
                  className={`cursor-pointer transition hover:bg-gray-50 ${
                    selectedLeadIds.includes(lead.id) ? "bg-primary-50" : ""
                  }`}
                >
                  {isBulkEditMode && (
                    <td
                      className="sticky left-0 z-10 bg-white px-2 sm:px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  <td className={`${
                    isBulkEditMode ? "sticky left-12 sm:left-auto sm:static" : "sticky left-0 sm:static"
                  } z-10 bg-white px-2 sm:px-4 py-3`}>
                    <div className="flex flex-col overflow-hidden min-w-[180px]">
                      <span
                        className="truncate font-semibold text-gray-900"
                        title={lead.name}
                      >
                        {lead.name}
                      </span>
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-primary-600 hover:underline"
                          title={lead.website}
                        >
                          {lead.website}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <select
                      value={lead.status || "Fresh Lead"}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateLead(lead.id, { status: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    >
                      <option value="Fresh Lead">Fresh Lead</option>
                      <option value="Interested">Interested</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-sm text-gray-600">
                    <span className="truncate block max-w-[100px]" title={lead.phone || ""}>
                      {lead.phone || "—"}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-sm text-gray-600">
                    <span
                      className="truncate block max-w-[120px]"
                      title={lead.owner_name || ""}
                    >
                      {lead.owner_name || "—"}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    {lead.rating ? (
                      <div className="flex items-center gap-1">
                        <svg
                          className="h-4 w-4 text-yellow-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-900">
                          {lead.rating}
                        </span>
                        {lead.reviews && (
                          <span className="text-xs text-gray-500">
                            ({lead.reviews})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className="px-2 sm:px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DatePicker
                      selected={lead.follow_up_date}
                      onChange={(date) =>
                        updateLead(lead.id, { follow_up_date: date })
                      }
                      className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                      placeholderText="Set date"
                      dateFormat="MMM d, yyyy"
                      isClearable
                    />
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <span
                      className="truncate block text-sm text-gray-600 max-w-[120px]"
                      title={lead.assigned_user_email || ""}
                    >
                      {lead.assigned_user_email || "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}{" "}
            leads
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      currentPage === pageNum
                        ? "bg-primary-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLead(null);
        }}
        onUpdate={(updatedLead) => {
          if (updatedLead === null) {
            // Lead was deleted, refresh the list
            fetchLeads();
          } else {
            // Lead was updated
            setLeads((prev) =>
              prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
            );
          }
        }}
      />

      {/* Assign Leads Modal */}
      <AssignLeadsModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedLeadIds={selectedLeadIds}
        onAssignComplete={handleAssignComplete}
      />
    </section>
  );
};

export default LeadList;
