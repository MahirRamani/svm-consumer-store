// FILE: components/dashboard/users/UsersTab.tsx
"use client";

import { useState, useEffect } from "react";
import UserCreateForm from "@/components/forms/UserCreateForm";
import UserList from "@/components/table/UserList";
import { User } from "@/types";

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // In a real app, you would fetch users from your API here
  }, []);

  const handleUserCreated = (newUser: User) => {
    setUsers(prevUsers => [newUser, ...prevUsers]);
  };

  return (
    <div className="space-y-8">
      <UserCreateForm onUserCreated={handleUserCreated} />
      <UserList users={users} />
    </div>
  );
}