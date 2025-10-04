"use client";

import { useState, useEffect } from "react";
import supabase from "../utils/supabase";

const AssignLeadsModal = ({
  isOpen,
  onClose,
  selectedLeadIds,
  onAssignComplete,
}) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter((user) =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      // Show first 3 users by default
      setFilteredUsers(users.slice(0, 3));
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role")
        .eq("is_authorized", true)
        .order("email");

      if (error) {
        console.error("Error fetching users:", error);
        setErrorMessage("Failed to load users. Please try again.");
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error("Error in fetchUsers:", error);
      setErrorMessage("Failed to load users. Please try again.");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      setErrorMessage("Please select a user to assign leads to.");
      return;
    }

    setIsAssigning(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          assigned_to: selectedUserId,
          updated_at: new Date().toISOString(),
        })
        .in("id", selectedLeadIds);

      if (error) {
        console.error("Error assigning leads:", error);
        setErrorMessage("Failed to assign leads. Please try again.");
      } else {
        // Success - close modal and notify parent
        onAssignComplete();
        handleClose();
      }
    } catch (error) {
      console.error("Error in handleAssign:", error);
      setErrorMessage("Failed to assign leads. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedUserId(null);
    setFilteredUsers([]);
    setErrorMessage("");
    onClose();
  };

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    setSearchTerm(users.find((u) => u.id === userId)?.email || "");
    setFilteredUsers([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Leads</h2>
            <p className="mt-1 text-sm text-gray-600">
              Assigning {selectedLeadIds.length} lead
              {selectedLeadIds.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
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

        {/* Content */}
        <div className="p-6">
          {errorMessage && (
            <div className="alert alert-error mb-4 animate-scale-in flex items-start gap-2">
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

          <div className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Search User by Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input w-full"
                  disabled={isLoading}
                />
                {isLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>

            {/* User Dropdown */}
            {filteredUsers.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {user.email}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {user.role}
                      </span>
                    </div>
                    {selectedUserId === user.id && (
                      <svg
                        className="h-5 w-5 text-primary-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Selected User Display */}
            {selectedUserId && (
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary-900">
                      Selected User
                    </p>
                    <p className="text-sm text-primary-700">
                      {users.find((u) => u.id === selectedUserId)?.email}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserId(null);
                      setSearchTerm("");
                    }}
                    className="rounded-lg p-1 text-primary-600 transition hover:bg-primary-100"
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
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-6">
          <button
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={isAssigning}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="btn btn-primary"
            disabled={!selectedUserId || isAssigning}
          >
            {isAssigning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Assigning...
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Assign Leads
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignLeadsModal;
