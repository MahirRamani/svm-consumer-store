// app/dashboard/categories-tab.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Search, AlertTriangle, Loader2, Eye, EyeOff, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import AddCategoryModal from '@/components/modals/add-category-modal';
import EditCategoryModal from '@/components/modals/edit-category-modal';

import type {
  Category,
  CategoriesResponse,
  CategoryFilterState
} from "@/types/seller/category";
import { ApiResponse } from '@/lib/api/base-handler';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';

export default function CategoriesTab() {
  const [filterState, setFilterState] = useState<CategoryFilterState>({
    searchTerm: "",
    showInactive: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");


  const queryClient = useQueryClient();

  // Fetch categories with type-safe response
  const {
    data: categoriesResponse,
    isLoading,
    error: categoriesError,
    isError: isCategoriesError,
  } = useQuery<ApiResponse<CategoriesResponse>, Error>({
    queryKey: ["categories", filterState.showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterState.showInactive) {
        params.append("includeInactive", "true");
      }

      const response = await fetch(`/api/categories?sortBy=name&sortOrder=asc&${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse<CategoriesResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch categories");
      }

      return data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Extract categories and counts from the response
  const categories = categoriesResponse?.data?.categories || [];
  const totalCategoriesCount = categoriesResponse?.data?.categories.length || 0;

  // Toggle category status mutation - using _id
  const toggleCategoryMutation = useMutation<
    ApiResponse<Category>,
    Error,
    { categoryId: string; isActive: boolean }
  >({
    mutationFn: async ({ categoryId, isActive }) => {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const result: ApiResponse<Category> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to update category: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category status updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });

  // Delete category mutation - using _id
  const deleteCategoryMutation = useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (categoryId: string) => {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to delete category: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted successfully.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });


  // Memoized filter change handler
  const handleFilterChange = useCallback((key: keyof CategoryFilterState, value: string | boolean) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleEditCategory = useCallback((category: Category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
  }, []);

  const handleToggleActive = useCallback((categoryId: string, currentStatus: boolean) => {
    setTogglingId(categoryId);
    toggleCategoryMutation.mutate(
      { categoryId, isActive: !currentStatus },
      { onSettled: () => setTogglingId(null) }
    );
  }, [toggleCategoryMutation]);

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  }, []);

  // Memoized filtered categories
  const filteredCategories = useMemo(() => {
    if (!Array.isArray(categories)) {
      return [];
    }

    return categories.filter((category: Category) => {
      if (!category) return false;

      const searchTerm = filterState.searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchTerm ||
        category.name?.toLowerCase().includes(searchTerm) ||
        category.description?.toLowerCase().includes(searchTerm);

      return matchesSearch;
    });
  }, [categories, filterState.searchTerm]);

  // CLIENT-SIDE EXPORT FUNCTIONALITY
  const handleExport = useCallback(() => {
    try {
      const headers = [
        "Category Name",
        "Description",
        "Priority",
        "Status",
        "Created At",
        "Updated At",
      ];

      const rows = filteredCategories.map((category: Category) => {
        const createdDate = new Date(category.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        const updatedDate = category.updatedAt
          ? new Date(category.updatedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          : "N/A";

        return [
          `"${category.name}"`,
          `"${category.description || "N/A"}"`,
          category.priority !== undefined ? category.priority : "N/A",
          category.isActive ? "Active" : "Inactive",
          createdDate,
          updatedDate,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `categories-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Categories exported successfully!");
    } catch (error) {
      toast.error("Failed to export categories");
    }
  }, [filteredCategories]);

  // Error state
  if (isCategoriesError) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Categories</h3>
          <p className="text-gray-600 mb-4">
            {categoriesError instanceof Error ? categoriesError.message : "An unknown error occurred"}
          </p>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["categories"] })}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={filteredCategories.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="pt-4 pb-5 mb-2">
        <CardContent className="p-6 py-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search Categories</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Name or description..."
                  value={filterState.searchTerm}
                  onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                  className="pl-10 pr-8"
                />
                {filterState.searchTerm && (
                  <button
                    onClick={() => handleFilterChange("searchTerm", "")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center pl-10">
              <Label className="text-sm font-medium text-gray-700">Categories Status</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Switch
                  checked={filterState.showInactive}
                  onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
                />
                <div>
                  <span className="text-sm text-gray-600">
                    {filterState.showInactive ? "Showing all categories" : "Showing active only"}
                  </span>
                  <p className="text-xs text-gray-400">
                    {filterState.showInactive ? "Toggle to hide inactive" : "Toggle to show inactive"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card className="pt-4">
        <CardHeader className="gap-0">
          <div className="flex items-center gap-3 pb-0">
            <CardTitle className="text-lg font-semibold text-gray-900">Categories</CardTitle>
            <p className="text-sm text-gray-600 m-0 pt-1">
              [{filteredCategories.length} of {totalCategoriesCount} categories]
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-500 mb-4">
                {categories.length === 0
                  ? "Get started by adding your first category."
                  : "Try adjusting your search or filters."}
              </p>
              {categories.length === 0 && (
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category Name</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCategories.map((category: Category) => (
                    <tr key={category._id} className={!category.isActive ? "bg-gray-50 opacity-75" : ""}>
                      <td className="px-6 py-2.5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${category.isActive ? "bg-blue-100" : "bg-gray-200"
                              }`}
                          >
                            📦
                          </div>
                          <div className="ml-3">
                            <p
                              className={`text-sm font-medium ${category.isActive ? "text-gray-900" : "text-gray-500"
                                }`}
                            >
                              {category.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900">
                        {category.description || "No description"}
                      </td>
                      <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900">
                        {category.priority !== undefined ? category.priority : "-"}
                      </td>
                      <td className="px-6 py-2.5 whitespace-nowrap">
                        <Badge
                          variant={category.isActive ? "default" : "secondary"}
                          className={
                            category.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
                          }
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500">
                        {new Date(category.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                            className="text-purple-500 hover:text-purple-600"
                            title="Edit Category"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(category._id, category.isActive)}
                            disabled={togglingId === category._id}
                            className={
                              category.isActive
                                ? "text-orange-500 hover:text-orange-600"
                                : "text-green-500 hover:text-green-600"
                            }
                            title={category.isActive ? "Deactivate Category" : "Activate Category"}
                          >
                            {togglingId === category._id ?
                              <Loader2 className="w-4 h-4 animate-spin" />
                              : category.isActive ?
                                <EyeOff className="w-4 h-4" />
                                :
                                <Eye className="w-4 h-4" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(category._id, category.name)}
                            className="text-red-500 hover:text-red-600"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddCategoryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />

      <EditCategoryModal
        open={showEditModal}
        onOpenChange={setShowEditModal} category={selectedCategory}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeleteConfirmId(null);
            setDeleteConfirmName("");
          }
        }}
        title={`Delete "${deleteConfirmName}"?`}
        description="This action cannot be undone. The category will be permanently removed."
        icon={Trash2}
        confirmLabel="Delete"
        loadingLabel="Deleting..."
        variant="destructive"
        isLoading={!!deleteConfirmId && deleteCategoryMutation.isPending}
        onConfirm={() => {
          if (!deleteConfirmId) return;
          deleteCategoryMutation.mutate(deleteConfirmId, {
            onSettled: () => {
              setDeleteConfirmId(null);
              setDeleteConfirmName("");
            },
          });
        }}
      />
    </div>
  );
}