// models/index.ts
// Just importing these will register them with Mongoose
import './Category'
import './Product'
import './StockTransaction'
import './Transaction'
import './Student'
import './User'
import './Account'
import './AccountTransaction'
import './AuditLog'
import './YearConfig'

// Optionally still export them for use elsewhere
export { Category } from './Category'
export { Product } from './Product'
export { StockTransaction } from './StockTransaction'
export { Transaction } from './Transaction'
export { Student } from './Student'
export { User } from './User'
export { Account } from './Account'
export { AccountTransaction } from './AccountTransaction'
export { AuditLog } from './AuditLog'
export { YearConfig } from './YearConfig'