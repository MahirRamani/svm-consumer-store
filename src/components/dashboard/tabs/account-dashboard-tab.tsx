"use client";

import { useState } from "react";
import { ChevronRight, Wallet, Receipt } from "lucide-react";
import AccountsTab from "@/components/dashboard/tabs/accounts-tab";
import AccountTransactionsTab from "@/components/dashboard/tabs/account-transactions-tab";
import type { Account } from "@/types/account";

// ── Breadcrumb ────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
  active: boolean;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-6">
      {items.map((item, i) => {
        const Icon = item.icon;
        const isLast = i === items.length - 1;

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}

            {item.active ? (
              // Current page — not clickable, full color
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {item.label}
              </span>
            ) : (
              // Ancestor — clickable, muted
              <button
                onClick={item.onClick}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ── Dashboard Router ──────────────────────────────────────────────────────

export default function AccountsDashboard() {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
  };

  const handleBack = () => {
    setSelectedAccount(null);
  };

  // Build breadcrumb items based on current view
  const breadcrumbItems: BreadcrumbItem[] = selectedAccount
    ? [
        {
          label: "Accounts",
          icon: Wallet,
          onClick: handleBack,
          active: false,
        },
        {
          label: selectedAccount.name,
          icon: Receipt,
          active: true,
        },
      ]
    : [
        {
          label: "Accounts",
          icon: Wallet,
          active: true,
        },
      ];

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      {selectedAccount ? (
        <AccountTransactionsTab account={selectedAccount} onBack={handleBack} />
      ) : (
        <AccountsTab onSelectAccount={handleSelectAccount} />
      )}
    </div>
  );
}

// "use client";

// /**
//  * accounts-dashboard.tsx
//  *
//  * This is the parent component that wires AccountsTab → AccountTransactionsTab.
//  * Drop this into your dashboard's tab registry instead of the individual tabs,
//  * OR use each tab independently by passing the right props via TABS_REGISTRY.
//  *
//  * Usage in TABS_REGISTRY (recommended):
//  *   account: { component: AccountsDashboard, ... }
//  *   (remove 'account-transactions' from registry entirely — navigation is internal)
//  */

// import { useState } from "react";
// import AccountsTab from "@/components/dashboard/tabs/accounts-tab";
// import AccountTransactionsTab from "@/components/dashboard/tabs/account-transactions-tab";
// import type { Account } from "@/types/account";

// export default function AccountsDashboard() {
//   const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

//   if (selectedAccount) {
//     return (
//       <AccountTransactionsTab
//         account={selectedAccount}
//         onBack={() => setSelectedAccount(null)}
//       />
//     );
//   }

//   return <AccountsTab onSelectAccount={setSelectedAccount} />;
// }