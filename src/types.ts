export type Order = {
  orderId: string;
  bookToken: string;
  execToken: string;
  bookAmount: bigint;
  execAmount: bigint;
  maker: string;
  salt: bigint;
  signature: string;

  freeBookAmount: bigint;
  price: bigint;
  time: number;
  duration: number;
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
