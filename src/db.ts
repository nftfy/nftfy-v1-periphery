import { Order } from './types';

export interface Db {
  insertOrder(order: Order): Promise<void>;
  removeOrder(orderId: string): Promise<void>;
  updateOrder(orderId: string, freeBookAmount: bigint): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  lookupOrders(bookToken: string, execToken: string, time: number): Promise<Order[]>;
  bookSumOrders(bookToken: string, maker: string): Promise<bigint>;
}
