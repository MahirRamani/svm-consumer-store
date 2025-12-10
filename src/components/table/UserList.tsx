// FILE: components/dashboard/users/UserList.tsx
"use client";

import { User } from "@/types/user";
import UserListItem from "../parts/UserListItem";
import { toast } from "sonner";

interface UserListProps {
  users: User[];
}

export default function UserList({ users }: UserListProps) {
  const handleEdit = (user: User) => {
    toast.info("Edit functionality not implemented.", {
      description: `You clicked edit for user: ${user.username}`
    });
  };

  const handleDelete = (userId: string) => {
    toast.warning("Delete functionality not implemented.", {
      description: `You clicked delete for user ID: ${userId}`
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Existing Users</h2>
      {users.length > 0 ? (
        <div className="grid gap-4">
          {users.map((user) => (
            <UserListItem 
              key={user._id} 
              user={user} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">
            No users created yet. Use the form above to add a new user.
          </p>
        </div>
      )}
    </div>
  );
}