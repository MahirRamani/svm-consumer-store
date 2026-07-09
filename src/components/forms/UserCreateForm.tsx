"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, EyeOff, Eye } from 'lucide-react';

import { User } from '@/types/user';
import { ApiResponse } from '@/lib/api/base-handler';
import { CreateUserSchema, CreateUserValues } from '@/schemas/user';
import { ROLES } from '@/lib/config/rolesConfig';
import { TabId, TABS_REGISTRY } from '@/lib/config/tabs-registry';

import { Button } from '@/components/ui/button';
import {
  Form, FormControl, FormDescription,
  FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle,
} from "@/components/ui/card";
import { useState } from 'react';

async function createUser(body: CreateUserValues): Promise<User> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: ApiResponse<User> = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Failed to create user");
  if (!json.data) throw new Error("No data returned from server");
  return json.data;
}

export default function UserCreateForm() {
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "",
      allowedTabs: [], // ✅ empty — no tab pre-selected
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully!", {
        description: `Username: ${newUser.username}`,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(values: CreateUserValues) {
    createUserMutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>
          Set up a new user and assign their specific dashboard tabs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Username + Password */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-3">
              <div className="flex flex-col gap-4">

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        {/* <Input type="password" placeholder="••••••••" {...field} /> */}
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pr-10" // Add padding to prevent text from overlapping the icon
                            {...field}
                          />
                          <button
                            type="button" // Prevents the button from accidently submitting the form
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Role */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(ROLES).map((role) => (
                            // ✅ value=role.id ("admin") not role.name ("ADMIN")
                            // This ensures what's sent to DB matches what edit form reads back
                            <SelectItem key={role.id} value={role.id}>
                              {role.id.charAt(0).toUpperCase() + role.id.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Allowed Tabs */}
              <FormField
                control={form.control}
                name="allowedTabs"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Allowed Tabs</FormLabel>
                      <FormDescription>
                        Select the dashboard tabs this user can access.
                      </FormDescription>
                    </div>
                    {/* <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                      {Object.entries(TABS_REGISTRY).map(([tabId, tab]) => (
                        <FormField
                          key={tabId}
                          control={form.control}
                          name="allowedTabs"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(tabId as TabId)}
                                  onCheckedChange={(checked) => {
                                    field.onChange(
                                      checked
                                        ? [...(field.value ?? []), tabId]
                                        : (field.value ?? []).filter((id) => id !== tabId)
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                <tab.icon className="w-4 h-4 text-muted-foreground" />
                                {tab.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div> */}
                    {/* Outer container splits into 2 true columns */}

                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">

                      {/* COLUMN 1: First half of the items */}
                      <div className="flex flex-col gap-4">
                        {Object.entries(TABS_REGISTRY)
                          .slice(0, Math.ceil(Object.keys(TABS_REGISTRY).length / 2))
                          .map(([tabId, tab]) => (
                            <FormField
                              key={tabId}
                              control={form.control}
                              name="allowedTabs"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(tabId as TabId)}
                                      onCheckedChange={(checked) => {
                                        field.onChange(
                                          checked
                                            ? [...(field.value ?? []), tabId]
                                            : (field.value ?? []).filter((id) => id !== tabId)
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                    <tab.icon className="w-4 h-4 text-muted-foreground" />
                                    {tab.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                      </div>

                      {/* COLUMN 2: Second half of the items */}
                      <div className="flex flex-col gap-4">
                        {Object.entries(TABS_REGISTRY)
                          .slice(Math.ceil(Object.keys(TABS_REGISTRY).length / 2))
                          .map(([tabId, tab]) => (
                            <FormField
                              key={tabId}
                              control={form.control}
                              name="allowedTabs"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(tabId as TabId)}
                                      onCheckedChange={(checked) => {
                                        field.onChange(
                                          checked
                                            ? [...(field.value ?? []), tabId]
                                            : (field.value ?? []).filter((id) => id !== tabId)
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                    <tab.icon className="w-4 h-4 text-muted-foreground" />
                                    {tab.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                      </div>

                    </div>


                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create User
              </Button>
            </div>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
}