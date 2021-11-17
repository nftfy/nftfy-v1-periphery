import fs from 'fs';

import { Order } from './types';
import { Db } from './db';

export function createDb(filename: string): Db {

  let db: { [bookToken: string]: { [execToken: string]: Order[] } } = {};
  let indexes: { [orderId: string]: { bookToken: string, execToken: string } } = {};

  function load(): void {
    const decodeBigInt = (key: string, value: unknown) => typeof value === 'string' && /-?\d+n/.test(value) ? BigInt(value.slice(0, -1)) : value;
    try { const data = JSON.parse(fs.readFileSync(filename).toString(), decodeBigInt); db = data.db; indexes = data.indexes; } catch (e) { }
  }

  function save(): void {
    const encodeBigInt = (key: string, value: unknown) => typeof value === 'bigint' ? value.toString() + 'n' : value;
    try { fs.writeFileSync(filename, JSON.stringify({ db, indexes }, encodeBigInt, 2)); } catch (e) { }
  }

  load();

  // INSERT INTO orders VALUES (...)
  async function insertOrder(order: Order): Promise<void> {
    const { orderId, bookToken, execToken } = order;
    if (indexes[orderId] !== undefined) throw new Error('Duplicate order: ' + orderId);
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    level1.push({ ...order });
    indexes[orderId] = { bookToken, execToken };
    save();
  }

  // DELETE FROM orders WHERE orderId = %orderId%
  async function removeOrder(orderId: string): Promise<void> {
    const item = indexes[orderId];
    if (item === undefined) throw new Error('Unknown order: ' + orderId);
    const { bookToken, execToken } = item;
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    const index = level1.findIndex((order) => order.orderId == orderId);
    if (index < 0) throw new Error('Panic');
    level1.splice(index, 1);
    delete indexes[orderId];
    save();
  }

  // UPDATE orders SET freeBookAmount = %freeBookAmount% WHERE orderId = %orderId%
  async function updateOrder(orderId: string, freeBookAmount: bigint): Promise<void> {
    const item = indexes[orderId];
    if (item === undefined) throw new Error('Unknown order: ' + orderId);
    const { bookToken, execToken } = item;
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    const index = level1.findIndex((order) => order.orderId == orderId);
    if (index < 0) throw new Error('Panic');
    const order = level1[index];
    if (order === undefined) throw new Error('Panic');
    order.freeBookAmount = freeBookAmount;
    save();
  }

  // SELECT * FROM orders WHERE orderId = %orderId%
  async function lookupOrder(orderId: string): Promise<Order | null> {
    const item = indexes[orderId];
    if (item === undefined) return null;
    const { bookToken, execToken } = item;
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    const index = level1.findIndex((order) => order.orderId == orderId);
    if (index < 0) throw new Error('Panic');
    const order = level1[index];
    if (order === undefined) throw new Error('Panic');
    return order;
  }

  // SELECT * FROM orders WHERE bookToken = %bookToken AND execToken = %execToken AND startTime <= %time AND %time < endTime ORDER BY price (ASC | DESC), time ASC
  async function lookupOrders(bookToken: string, execToken: string, time: number, direction: 'asc' | 'desc'): Promise<Order[]> {
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    const orders = [...level1.filter((order) => order.startTime <= time && time < order.endTime)];
    if (direction === 'asc') {
      orders.sort((order1, order2) => order1.price < order2.price ? -1 : order1.price > order2.price ? 1 : order1.time - order2.time);
      return orders;
    }
    if (direction === 'desc') {
      orders.sort((order1, order2) => order2.price < order1.price ? -1 : order2.price > order1.price ? 1 : order1.time - order2.time);
      return orders;
    }
    throw new Error('Panic');
  }

  // SELECT SUM(freeBookAmount) FROM orders WHERE bookToken = %bookToken AND maker = %maker
  async function bookSumOrders(bookToken: string, maker: string): Promise<bigint> {
    const level0 = db[bookToken] || (db[bookToken] = {});
    let sum = 0n;
    for (const level1 of Object.values(level0)) {
      const orders = [...level1.filter((order) => order.maker === maker)];
      sum += orders.reduce((acc, order) => acc + order.freeBookAmount, 0n);
    }
    return sum;
  }

  return { insertOrder, removeOrder, updateOrder, lookupOrder, lookupOrders, bookSumOrders };
}
