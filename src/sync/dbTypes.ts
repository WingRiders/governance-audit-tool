import { Block } from "../prismaClient";
export type DbBlock = Omit<Block, "hash"> & { hash: string };
