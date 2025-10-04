"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Analytics from "./components/Analytics";
import ImportModal from "./components/ImportModal";
import BulkCSVImport from "./components/BulkCSVImport";
import LeadList from "./components/LeadList";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import supabase from "./utils/supabase";
import { useAuth } from "./contexts/AuthContext";

type Category = {
  id: number;
  name: string;
};

const HomePage = () => {
  const router = useRouter();
  const { user, loading, isAuthorized } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "analytics">("leads");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const hasLoadedRef = useState(false);

  const loadCategories = useCallback(
    async (categoryIdToSelect?: number) => {
      // Don't load if user is not ready
      if (!user) {
        return;
      }

      setIsLoadingCategories(true);
      setCategoryError("");

      try {
        // Ensure session is active before making requests
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.error("No active session");
          setCategoryError("Session expired. Please refresh the page.");
          setIsLoadingCategories(false);
          return;
        }

        // First, check if user has category restrictions
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("has_category_restrictions, role")
          .eq("id", user.id)
          .single();

        const hasRestrictions = profileData?.has_category_restrictions;
        const isAdmin =
          profileData?.role === "admin" || profileData?.role === "superadmin";

        // Get all categories
        const { data: allCategories, error: categoriesError } = await supabase
          .from("categories")
          .select("*")
          .order("created_at", { ascending: false });

        if (categoriesError) throw categoriesError;

        let categoryList: Category[] = allCategories ?? [];

        // For regular users (non-admin), only show assigned categories
        if (!isAdmin) {
          const { data: assignments } = await supabase
            .from("user_category_assignments")
            .select("category_id")
            .eq("user_id", user?.id);

          const assignedCategoryIds =
            assignments?.map((a) => a.category_id) ?? [];

          // If user has no assignments, show empty list
          categoryList = categoryList.filter((cat) =>
            assignedCategoryIds.includes(cat.id)
          );
        }

        setCategories(categoryList);
        setIsLoadingCategories(false);

        if (categoryIdToSelect !== undefined) {
          setSelectedCategoryId(categoryIdToSelect);
          return;
        }

        // Only auto-select if user has categories
        if (categoryList.length > 0) {
          if (!selectedCategoryId) {
            setSelectedCategoryId(categoryList[0].id);
          } else if (
            !categoryList.some((category) => category.id === selectedCategoryId)
          ) {
            setSelectedCategoryId(categoryList[0].id);
          }
        } else {
          // No categories available, clear selection
          setSelectedCategoryId(null);
        }
      } catch (error) {
        console.error("Failed to fetch categories", error);
        setCategoryError("Unable to load categories. Please refresh the page.");
        setCategories([]);
        setIsLoadingCategories(false);
      }
    },
    [user, selectedCategoryId]
  );

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === null) {
      return null;
    }

    return (
      categories.find((category) => category.id === selectedCategoryId) ?? null
    );
  }, [categories, selectedCategoryId]);

  // Redirect to login if not authenticated or unauthorized
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!isAuthorized) {
        router.replace("/unauthorized");
      }
    }
  }, [user, loading, isAuthorized, router]);

  // Handle OAuth hash tokens (implicit flow)
  useEffect(() => {
    const handleHashTokens = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        try {
          // Let Supabase handle the hash tokens
          const { error } = await supabase.auth.getSession();
          if (!error) {
            // Clear the hash from URL
            window.history.replaceState(null, "", window.location.pathname);
            // Reload to get user session
            window.location.reload();
          }
        } catch (error) {
          console.error("Error handling hash tokens:", error);
        }
      }
    };

    handleHashTokens();
  }, []);

  // Load categories on mount - wait for both user and authorization
  useEffect(() => {
    console.log("Load categories effect:", {
      user: !!user,
      loading,
      isAuthorized,
    });
    if (user && !loading && isAuthorized && !hasLoadedRef[0]) {
      console.log("Loading categories...");
      hasLoadedRef[1](true);
      loadCategories();
    }
  }, [user, loading, isAuthorized, loadCategories, hasLoadedRef]);

  // Show loading state while checking authentication
  if (loading) {
    console.log(
      "Showing loading screen - loading:",
      loading,
      "user:",
      !!user,
      "isAuthorized:",
      isAuthorized
    );
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not authorized
  if (!user || !isAuthorized) {
    return null;
  }

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedCategoryId(value ? Number(value) : null);
  };

  const handleImportComplete = (category: Category) => {
    loadCategories(category.id);
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId || !selectedCategory) {
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the category "${selectedCategory.name}"? This will also delete all associated leads and cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    setIsLoadingCategories(true);
    setCategoryError("");

    try {
      // First, delete all lead_categories associations
      const { error: leadCategoriesError } = await supabase
        .from("lead_categories")
        .delete()
        .eq("category_id", selectedCategoryId);

      if (leadCategoriesError) {
        throw new Error(
          `Failed to delete category associations: ${leadCategoriesError.message}`
        );
      }

      // Then delete the category itself
      const { error: categoryError } = await supabase
        .from("categories")
        .delete()
        .eq("id", selectedCategoryId);

      if (categoryError) {
        throw new Error(`Failed to delete category: ${categoryError.message}`);
      }

      // Reload categories and select the first one if available
      await loadCategories();
    } catch (error) {
      console.error("Delete category error", error);
      setCategoryError(
        error instanceof Error
          ? error.message
          : "Failed to delete category. Please try again."
      );
      setIsLoadingCategories(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <Navbar onMobileSidebarToggle={() => setIsMobileSidebarOpen(true)} />

      {/* Main Content with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          isLoadingCategories={isLoadingCategories}
          categoryError={categoryError}
          onCategoryChange={handleCategoryChange}
          onRefresh={() => loadCategories(selectedCategoryId ?? undefined)}
          onDeleteCategory={handleDeleteCategory}
          onImportClick={() => setIsImportModalOpen(true)}
          onBulkImportClick={() => setIsBulkImportModalOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
              <button
                onClick={() => setActiveTab("leads")}
                className={`whitespace-nowrap border-b-2 px-1 py-3 sm:py-4 text-sm font-medium transition touch-target ${
                  activeTab === "leads"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5"
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
                  <span className="hidden sm:inline">Leads</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`whitespace-nowrap border-b-2 px-1 py-3 sm:py-4 text-sm font-medium transition touch-target ${
                  activeTab === "analytics"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Analytics</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {categories.length === 0 && !isLoadingCategories ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No Categories Assigned
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                You don't have access to any categories yet. Please contact your
                administrator to get category access.
              </p>
            </div>
          ) : activeTab === "leads" ? (
            <LeadList
              categoryId={selectedCategoryId}
              onImportClick={() => setIsImportModalOpen(true)}
            />
          ) : (
            <Analytics categoryId={selectedCategoryId} />
          )}
        </main>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onComplete={handleImportComplete}
      />

      {/* Bulk CSV Import Modal */}
      <BulkCSVImport
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onComplete={() => loadCategories()}
      />
    </div>
  );
};

export default HomePage;
