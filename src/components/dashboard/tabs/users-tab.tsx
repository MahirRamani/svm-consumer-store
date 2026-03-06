"use client";
import { useState, useEffect } from "react";
import UserCreateForm from "@/components/forms/UserCreateForm";
import UserList from "@/components/table/UserList";
import { User } from "@/types/user";

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/users")
      .then(res => res.json())
      .then(data => {
        setUsers(data.data.users);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch users:", error);
        setIsLoading(false);
      });
  }, []);

  const handleUserCreated = (newUser: User) => {
    setUsers(prevUsers => [newUser, ...prevUsers]);
  };

  const handleUserDeleted = (userId: string) => {
    setUsers(prevUsers => prevUsers.filter(user => user._id !== userId));
  };

  const handleUserEdited = (updatedUser: User) => {
    setUsers(prevUsers =>
      prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user)
    );
  };

  return (
    <div className="space-y-8 m-0">
      <UserCreateForm onUserCreated={handleUserCreated} />
      <UserList 
        users={users} 
        isLoading={isLoading}
        onUserDeleted={handleUserDeleted}
        onUserEdited={handleUserEdited}
      />
    </div>
  );
}





// "use client";

// import { useState, useEffect } from "react";
// import UserCreateForm from "@/components/forms/UserCreateForm";
// import UserList from "@/components/table/UserList";
// import { User } from "@/types/user";

// export default function UsersTab() {
//   const [users, setUsers] = useState<User[]>([]);

//   useEffect(() => {
//     fetch("/api/users")
//       .then(res => res.json())
//       .then(data => setUsers(data.data.users));
//   }, []);

//   const handleUserCreated = (newUser: User) => {
//     setUsers(prevUsers => [newUser, ...prevUsers]);
//   };

//   return (
//     <div className="space-y-8">
//       <UserCreateForm onUserCreated={handleUserCreated} />
//       <UserList users={users} />
//     </div>
//   );
// }