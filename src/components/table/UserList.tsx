"use client";

import { User } from "@/types/user";
import UserListItem from "../parts/UserListItem";
import { toast } from "sonner";

interface UserListProps {
  users: User[];
  isLoading?: boolean;
  onUserDeleted?: (userId: string) => void;
  onUserEdited?: (updatedUser: User) => void;
}

export default function UserList({ 
  users, 
  isLoading = false,
  onUserDeleted,
  onUserEdited 
}: UserListProps) {
  const handleEdit = (user: User) => {
    if (onUserEdited) {
      // TODO: Implement actual edit logic (e.g., open modal/form)
      // For now, just show a toast
      toast.info("Edit functionality not implemented.", {
        description: `You clicked edit for user: ${user.username}`
      });
    }
  };

  const handleDelete = async (userId: string) => {
    if (onUserDeleted) {
      try {
        // TODO: Implement actual API call
        // const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        // if (response.ok) {
        //   onUserDeleted(userId);
        //   toast.success("User deleted successfully");
        // }
        
        toast.warning("Delete functionality not implemented.", {
          description: `You clicked delete for user ID: ${userId}`
        });
      } catch (error) {
        toast.error("Failed to delete user");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Existing Users</h2>
        <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

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


// "use client";

// import { User } from "@/types/user";
// import UserListItem from "../parts/UserListItem";
// import { toast } from "sonner";

// interface UserListProps {
//   users: User[];
// }

// export default function UserList({ users }: UserListProps) {
//   const handleEdit = (user: User) => {
//     toast.info("Edit functionality not implemented.", {
//       description: `You clicked edit for user: ${user.username}`
//     });
//   };

//   const handleDelete = (userId: string) => {
//     toast.warning("Delete functionality not implemented.", {
//       description: `You clicked delete for user ID: ${userId}`
//     });
//   };

//   return (
//     <div className="space-y-4">
//       <h2 className="text-2xl font-bold">Existing Users</h2>
//       {users.length > 0 ? (
//         <div className="grid gap-4">
//           {users.map((user) => (
//             <UserListItem 
//               key={user._id} 
//               user={user} 
//               onEdit={handleEdit} 
//               onDelete={handleDelete} 
//             />
//           ))}
//         </div>
//       ) : (
//         <div className="text-center p-8 border-2 border-dashed rounded-lg">
//           <p className="text-sm text-muted-foreground">
//             No users created yet. Use the form above to add a new user.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }