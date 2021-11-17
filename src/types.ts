export type Order = {
  orderId: string;
  bookToken: string;
  execToken: string;
  bookAmount: bigint;
  execAmount: bigint;
  maker: string;
  salt: bigint;
  signature: string;

  price: bigint;
  time: number;
  startTime: number;
  endTime: number;
  freeBookAmount: bigint;
};

export type PreparedExecution = {
  bookToken: string;
  execToken: string;
  orderIds: string[];
  bookAmounts: bigint[];
  execAmounts: bigint[];
  makers: string[];
  salts: bigint[];
  signatures: string[];
  lastRequiredBookAmount: bigint;
};
