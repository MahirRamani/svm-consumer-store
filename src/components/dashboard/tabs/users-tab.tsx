"use client";

import UserCreateForm from '@/components/forms/UserCreateForm';
import UserList from '@/components/table/UserList';
import { User } from '@/types/user';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiResponse } from '@/lib/api/base-handler';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  const json: ApiResponse<{ users: User[] }> = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Failed to fetch users");
  return json.data?.users ?? [];
}

export default function UsersTab() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <div className="space-y-8 m-0">
      <UserCreateForm />
      <UserList users={users} isLoading={isLoading} />
    </div>
  );
}