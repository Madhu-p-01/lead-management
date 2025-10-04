"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import supabase from "../utils/supabase";
import LeadDetailModal from "./LeadDetailModal";

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
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Modal state
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  }, [leads, searchTerm, statusFilter, sortField, sortDirection]);

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

      const { data, error } = await supabase
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
            status,
            follow_up_date,
            notes,
            created_at,
            lead_categories!inner ( category_id )
          `
        )
        .eq("lead_categories.category_id", Number(categoryId))
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching leads", error);
        setErrorMessage("Unable to load leads for this category right now.");
        setLeads([]);
        setFilteredLeads([]);
        setIsLoading(false);
        return;
      }

      const normalized = (data || []).map((lead) => ({
        ...lead,
        follow_up_date: lead.follow_up_date
          ? new Date(lead.follow_up_date)
          : null,
      }));

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
          lead.website?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle dates
      if (sortField === "created_at" || sortField === "follow_up_date") {
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
        </div>
        <button onClick={onImportClick} className="btn btn-primary">
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Import Leads
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Search</label>
          <input
            type="text"
            placeholder="Search by name, phone, owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="All">All Statuses</option>
            <option value="Fresh Lead">Fresh Lead</option>
            <option value="Interested">Interested</option>
            <option value="Not Interested">Not Interested</option>
            <option value="Follow-up">Follow-up</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Sort By</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="input"
          >
            <option value="created_at">Date Added</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="rating">Rating</option>
            <option value="follow_up_date">Follow-up Date</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">
            Items per page
          </label>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="input"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
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
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="w-[25%] cursor-pointer px-4 py-3 text-left"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="w-[15%] cursor-pointer px-4 py-3 text-left"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Phone
              </th>
              <th className="w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Owner
              </th>
              <th
                className="w-[10%] cursor-pointer px-4 py-3 text-left"
                onClick={() => handleSort("rating")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Rating
                  <SortIcon field="rating" />
                </div>
              </th>
              <th
                className="w-[15%] cursor-pointer px-4 py-3 text-left"
                onClick={() => handleSort("follow_up_date")}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Follow-up
                  <SortIcon field="follow_up_date" />
                </div>
              </th>
              <th className="w-[8%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <>
                {[...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
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
                      <div className="h-8 w-8 rounded-lg bg-gray-200"></div>
                    </td>
                  </tr>
                ))}
              </>
            ) : currentLeads.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col overflow-hidden">
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
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="truncate block" title={lead.phone || ""}>
                      {lead.phone || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span
                      className="truncate block"
                      title={lead.owner_name || ""}
                    >
                      {lead.owner_name || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                    className="px-4 py-3"
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
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLead(lead);
                        setIsModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                      title="View details"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </section>
  );
};

export default LeadList;
