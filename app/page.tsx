"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import CSVImport from "./components/CSVImport";
import LeadList from "./components/LeadList";
import supabase from "./utils/supabase";

type Category = {
  id: number;
  name: string;
};

const HomePage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId === null) {
      return null;
    }

    return categories.find((category) => category.id === selectedCategoryId) ?? null;
  }, [categories, selectedCategoryId]);

  const loadCategories = async (categoryIdToSelect?: number) => {
    setIsLoadingCategories(true);
    setCategoryError("");

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch categories", error);
      setCategoryError("Unable to load categories. Please refresh the page.");
      setCategories([]);
      setIsLoadingCategories(false);
      return;
    }

    const categoryList: Category[] = data ?? [];
    setCategories(categoryList);
    setIsLoadingCategories(false);

    if (categoryIdToSelect !== undefined) {
      setSelectedCategoryId(categoryIdToSelect);
      return;
    }

    if (!selectedCategoryId && categoryList.length > 0) {
      setSelectedCategoryId(categoryList[0].id);
    } else if (
      selectedCategoryId &&
      !categoryList.some((category) => category.id === selectedCategoryId) &&
      categoryList.length > 0
    ) {
      setSelectedCategoryId(categoryList[0].id);
    }
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedCategoryId(value ? Number(value) : null);
  };

  const handleImportComplete = (category: Category) => {
    loadCategories(category.id);
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-12 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold sm:text-4xl">Lead Management Dashboard</h1>
              <p className="max-w-2xl text-sm text-blue-100 sm:text-base">
                Keep every opportunity organized, set follow-ups you will actually remember, and share the latest notes with your team.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-blue-100 md:items-end">
              <span className="rounded-full bg-white/10 px-4 py-2 font-semibold uppercase tracking-wide text-white">
                {categories.length} categor{categories.length === 1 ? "y" : "ies"}
              </span>
              <span className="text-sm">
                Selected: {selectedCategory ? selectedCategory.name : "Select a category"}
              </span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
                {isLoadingCategories && <span className="text-xs text-gray-400">Refreshing...</span>}
              </div>

              <p className="mt-2 text-sm text-gray-600">
                Importing a CSV automatically creates a new category if it does not already exist.
              </p>

              {categoryError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {categoryError}
                </div>
              )}

              <div className="mt-5 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="category-select" className="text-sm font-semibold text-gray-800">
                    Active category
                  </label>
                  <select
                    id="category-select"
                    value={selectedCategoryId ?? ""}
                    onChange={handleCategoryChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => loadCategories(selectedCategoryId ?? undefined)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  Refresh categories
                </button>
              </div>
            </section>

            <CSVImport onComplete={handleImportComplete} />
          </div>

          <LeadList categoryId={selectedCategoryId} />
        </div>
      </div>
    </main>
  );
};

export default HomePage;
