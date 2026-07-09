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


// "use client";
// import { useState, useEffect } from 'react';
// import UserCreateForm from '@/components/forms/UserCreateForm';
// import UserList from '@/components/table/UserList';
// import { User } from '@/types/user';

// export default function UsersTab() {
//   const [users, setUsers] = useState<User[]>([]);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     setIsLoading(true);
//     fetch("/api/users")
//       .then(res => res.json())
//       .then(data => {
//         setUsers(data.data.users);
//         setIsLoading(false);
//       })
//       .catch(error => {
//         console.error("Failed to fetch users:", error);
//         setIsLoading(false);
//       });
//   }, []);

//   const handleUserCreated = (newUser: User) => {
//     setUsers(prevUsers => [newUser, ...prevUsers]);
//   };

//   const handleUserDeleted = (userId: string) => {
//     setUsers(prevUsers => prevUsers.filter(user => user._id !== userId));
//   };

//   const handleUserEdited = (updatedUser: User) => {
//     setUsers(prevUsers =>
//       prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user)
//     );
//   };

//   return (
//     <div className="space-y-8 m-0">
//       <UserCreateForm onUserCreated={handleUserCreated} />
//       <UserList
//         users={users}
//         isLoading={isLoading}
//         onUserDeleted={handleUserDeleted}
//         onUserEdited={handleUserEdited}
//       />
//     </div>
//   );
// }





// // "use client";

// // import { useState, useEffect } from 'react';
// // import UserCreateForm from '@/components/forms/UserCreateForm';
// // import UserList from '@/components/table/UserList';
// // import { User } from '@/types/user';

// // export default function UsersTab() {
// //   const [users, setUsers] = useState<User[]>([]);

// //   useEffect(() => {
// //     fetch("/api/users")
// //       .then(res => res.json())
// //       .then(data => setUsers(data.data.users));
// //   }, []);

// //   const handleUserCreated = (newUser: User) => {
// //     setUsers(prevUsers => [newUser, ...prevUsers]);
// //   };

// //   return (
// //     <div className="space-y-8">
// //       <UserCreateForm onUserCreated={handleUserCreated} />
// //       <UserList users={users} />
// //     </div>
// //   );
// // }