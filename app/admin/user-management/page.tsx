"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import CategoryAssignmentModal from "../../components/CategoryAssignmentModal";
import supabase from "../../utils/supabase";

type AuthorizedUser = {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminPage() {
  const { user, loading, userRole, isAuthorized } = useAuth();
  const router = useRouter();
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isLoadingRef, setIsLoadingRef] = useState(false); // Prevent multiple simultaneous loads
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [allCategories, setAllCategories] = useState<
    { id: number; name: string }[]
  >([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedUserForCategories, setSelectedUserForCategories] = useState<{
    email: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      router.push("/login");
    } else if (
      !loading &&
      user &&
      userRole !== "superadmin" &&
      userRole !== "admin"
    ) {
      router.push("/");
    } else if (
      !loading &&
      user &&
      (userRole === "superadmin" || userRole === "admin")
    ) {
      loadAuthorizedUsers();
      loadCategories();
    }
  }, [user, loading, isAuthorized, userRole]);

  // Keep Supabase connection alive
  useEffect(() => {
    if (!user) return;

    const keepAlive = setInterval(async () => {
      try {
        await supabase.from("user_profiles").select("id").limit(1);
      } catch (error) {
        console.error("Keepalive ping failed:", error);
      }
    }, 5000);

    return () => clearInterval(keepAlive);
  }, [user]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;

      setAllCategories(data || []);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadAuthorizedUsers = async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef) {
      return;
    }

    setIsLoadingRef(true);
    setLoadingUsers(true);

    try {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAuthorizedUsers(data || []);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users");
    } finally {
      setLoadingUsers(false);
      setIsLoadingRef(false);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newUserEmail || !newUserEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setAdding(true);
    try {
      // Refresh connection before operation
      await supabase.from("user_profiles").select("id").limit(1);

      const email = newUserEmail.toLowerCase().trim();

      // Check if user exists in auth.users
      const { data: authUser } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (authUser) {
        // Determine if user should have category restrictions
        const hasRestrictions =
          selectedCategories.length > 0 && newUserRole === "user";

        // User exists, update their profile
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({
            role: newUserRole,
            is_authorized: true,
            has_category_restrictions: hasRestrictions,
            added_by: user?.id,
          })
          .eq("email", email);

        if (updateError) throw updateError;

        // If categories were selected, assign them
        if (selectedCategories.length > 0) {
          // First, remove any existing category assignments
          await supabase
            .from("user_category_assignments")
            .delete()
            .eq("user_id", authUser.id);

          // Then add new assignments
          const assignments = selectedCategories.map((categoryId) => ({
            user_id: authUser.id,
            category_id: categoryId,
          }));

          const { error: assignError } = await supabase
            .from("user_category_assignments")
            .insert(assignments);

          if (assignError) throw assignError;
        }

        setSuccess(
          `Successfully added ${email}${
            selectedCategories.length > 0
              ? ` with ${selectedCategories.length} category assignment(s)`
              : ""
          }`
        );
      } else {
        setError("User must sign in at least once before being added");
        setAdding(false);
        return;
      }

      setNewUserEmail("");
      setNewUserRole("user");
      setSelectedCategories([]);
      loadAuthorizedUsers();
    } catch (err) {
      console.error("Error adding user:", err);
      setError("Failed to add user");
    } finally {
      setAdding(false);
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      // Refresh connection before operation
      await supabase.from("user_profiles").select("id").limit(1);

      const userToUpdate = authorizedUsers.find((u) => u.id === userId);
      if (!userToUpdate) {
        throw new Error("User not found");
      }

      // Update user_profiles table only
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_authorized: !currentStatus })
        .eq("email", userToUpdate.email);

      if (error) throw error;

      setSuccess("User status updated");
      loadAuthorizedUsers();
    } catch (err) {
      console.error("Error updating user:", err);
      setError("Failed to update user status");
    }
  };

  const deleteUser = async (userId: number, email: string) => {
    if (
      !confirm(
        `Are you sure you want to remove ${email} from authorized users?`
      )
    ) {
      return;
    }

    try {
      // Refresh connection before operation
      await supabase.from("user_profiles").select("id").limit(1);

      // Update user_profiles to revoke access
      const { error } = await supabase
        .from("user_profiles")
        .update({
          is_authorized: false,
          role: "user",
        })
        .eq("email", email);

      if (error) throw error;

      setSuccess(`Removed ${email}`);
      loadAuthorizedUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      setError("Failed to remove user");
    }
  };

  const updateUserRole = async (userId: number, newRole: string) => {
    try {
      const userToUpdate = authorizedUsers.find((u) => u.id === userId);
      if (!userToUpdate) {
        throw new Error("User not found");
      }

      // Refresh connection before update
      await supabase.from("user_profiles").select("id").limit(1);

      // Update user_profiles table only
      const { data, error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("email", userToUpdate.email)
        .select();

      if (error) throw error;

      // Small delay to ensure view updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reload the list to show updated data
      await loadAuthorizedUsers();

      // Show success message after reload
      setSuccess(`User role updated to ${newRole}`);
    } catch (err) {
      console.error("Error updating role:", err);
      setError("Failed to update user role");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Navbar />

        <div className="flex flex-1">
          {/* Sidebar */}
          <Sidebar
            categories={[]}
            selectedCategoryId={null}
            isLoadingCategories={false}
            categoryError=""
            onCategoryChange={() => {}}
            onRefresh={() => {}}
            onDeleteCategory={() => {}}
            onImportClick={() => {}}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto p-6">
            {/* Header Skeleton */}
            <div className="mb-8">
              <div className="h-8 w-64 animate-pulse rounded bg-gray-200"></div>
              <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200"></div>
            </div>

            {/* Form Skeleton */}
            <div className="mb-8 rounded-lg bg-white p-6 shadow">
              <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-200"></div>
              <div className="flex gap-4">
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-200"></div>
                <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200"></div>
                <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200"></div>
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="divide-y divide-gray-200">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-gray-200"></div>
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
                    <div className="ml-auto h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg bg-white p-6 shadow">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                  <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200"></div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user || (userRole !== "superadmin" && userRole !== "admin")) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Main Content with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          categories={[]}
          selectedCategoryId={null}
          isLoadingCategories={false}
          categoryError=""
          onCategoryChange={() => {}}
          onRefresh={() => {}}
          onDeleteCategory={() => {}}
          onImportClick={() => {}}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              User Management
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage authorized users and their access levels
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="ml-3 text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-lg bg-green-50 p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="ml-3 text-sm text-green-800">{success}</p>
              </div>
            </div>
          )}

          {/* Add User Form */}
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Add New User
            </h2>
            <form onSubmit={addUser} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
                <div className="w-48">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {userRole === "superadmin" && (
                      <option value="superadmin">Superadmin</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Category Assignment */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Assign Categories (Optional)
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 p-2">
                  {allCategories.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">
                      No categories available
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {allCategories.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([
                                  ...selectedCategories,
                                  category.id,
                                ]);
                              } else {
                                setSelectedCategories(
                                  selectedCategories.filter(
                                    (id) => id !== category.id
                                  )
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {category.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Select categories this user can access. Leave empty for
                  admin/superadmin roles.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Added
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {authorizedUsers.map((authUser) => (
                  <tr key={authUser.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {authUser.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <select
                        value={authUser.role}
                        onChange={(e) =>
                          updateUserRole(authUser.id, e.target.value)
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                        disabled={
                          authUser.email === user?.email || loadingUsers
                        }
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        {userRole === "superadmin" && (
                          <option value="superadmin">Superadmin</option>
                        )}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          authUser.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {authUser.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(authUser.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={async () => {
                            // Get user ID from auth.users
                            const { data: userData } = await supabase
                              .from("user_profiles")
                              .select("id")
                              .eq("email", authUser.email)
                              .single();

                            if (userData) {
                              setSelectedUserForCategories({
                                email: authUser.email,
                                id: userData.id,
                              });
                              setCategoryModalOpen(true);
                            }
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="Assign Categories"
                        >
                          Categories
                        </button>
                        <button
                          onClick={() =>
                            toggleUserStatus(authUser.id, authUser.is_active)
                          }
                          className="text-blue-600 hover:text-blue-900"
                          disabled={authUser.email === user?.email}
                        >
                          {authUser.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() =>
                            deleteUser(authUser.id, authUser.email)
                          }
                          className="text-red-600 hover:text-red-900"
                          disabled={authUser.email === user?.email}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {authorizedUsers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">
                  No authorized users found
                </p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">
                Total Users
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {authorizedUsers.length}
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">
                Active Users
              </div>
              <div className="mt-2 text-3xl font-bold text-green-600">
                {authorizedUsers.filter((u) => u.is_active).length}
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">Admins</div>
              <div className="mt-2 text-3xl font-bold text-blue-600">
                {
                  authorizedUsers.filter(
                    (u) => u.role === "admin" || u.role === "superadmin"
                  ).length
                }
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Category Assignment Modal */}
      {selectedUserForCategories && (
        <CategoryAssignmentModal
          isOpen={categoryModalOpen}
          onClose={() => {
            setCategoryModalOpen(false);
            setSelectedUserForCategories(null);
          }}
          userEmail={selectedUserForCategories.email}
          userId={selectedUserForCategories.id}
        />
      )}
    </div>
  );
}
