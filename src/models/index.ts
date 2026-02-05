// models/index.ts
// Just importing these will register them with Mongoose
import './Category'
import './Product'
import './StockTransaction'
import './Transaction'
import './Student'
import './User'

// Optionally still export them for use elsewhere
export { Category } from './Category'
export { Product } from './Product'
export { StockTransaction } from './StockTransaction'
export { Transaction } from './Transaction'
export { Student } from './Student'
export { User } from './User'