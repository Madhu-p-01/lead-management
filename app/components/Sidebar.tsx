"use client";

import { ChangeEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";

type Category = {
  id: number;
  name: string;
};

type SidebarProps = {
  categories: Category[];
  selectedCategoryId: number | null;
  isLoadingCategories: boolean;
  categoryError: string;
  onCategoryChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onRefresh: () => void;
  onDeleteCategory: () => void;
  onImportClick: () => void;
};

const AdminSection = () => {
  const { userRole } = useAuth();
  const router = useRouter();

  if (userRole !== "superadmin" && userRole !== "admin") {
    return null;
  }

  return (
    <div className="mt-6 space-y-2 border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-700">Administration</h3>
      <div className="space-y-1">
        <button
          onClick={() => router.push("/admin/user-management")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-blue-50 hover:text-blue-700"
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          User Management
        </button>
      </div>
    </div>
  );
};

const Sidebar = ({
  categories,
  selectedCategoryId,
  isLoadingCategories,
  categoryError,
  onCategoryChange,
  onRefresh,
  onDeleteCategory,
  onImportClick,
}: SidebarProps) => {
  const router = useRouter();

  return (
    <aside className="w-full border-r border-gray-200 bg-white lg:w-80">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-6">
        {/* Categories Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">Categories</h2>
            </div>
            {isLoadingCategories && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500"></div>
                <span className="text-xs font-medium text-primary-600">
                  Loading...
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Manage your lead categories and import new leads.
          </p>
        </div>

        {/* Error Message */}
        {categoryError && (
          <div className="alert alert-error mb-4 animate-scale-in">
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
            {categoryError}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mb-6 space-y-2">
          <button
            onClick={() => router.push("/")}
            className="btn btn-secondary w-full"
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            View Leads
          </button>
          <button onClick={onImportClick} className="btn btn-primary w-full">
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Import CSV
          </button>
        </div>

        {/* Category Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="category-select"
              className="flex items-center gap-2 text-sm font-semibold text-gray-800"
            >
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Active Category
            </label>
            <select
              id="category-select"
              value={selectedCategoryId ?? ""}
              onChange={onCategoryChange}
              className="input"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-secondary flex-1"
              title="Refresh categories"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
            <button
              type="button"
              onClick={onDeleteCategory}
              disabled={!selectedCategoryId || isLoadingCategories}
              className="btn inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-all duration-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title="Delete category"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Stats */}
        {categories.length > 0 && (
          <div className="mt-6 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Statistics</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Categories</span>
                <span className="font-semibold text-gray-900">
                  {categories.length}
                </span>
              </div>
              {selectedCategoryId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Selected</span>
                  <span className="font-semibold text-primary-600">
                    {categories.find((c) => c.id === selectedCategoryId)?.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Section */}
        <AdminSection />
      </div>
    </aside>
  );
};

export default Sidebar;
