export type MemReader = (addr: number) => number;
export type MemWriter = (addr: number, val: number) => void;

export class MemBlock {
  start: number;
  len: number;
  read?: MemReader;
  write?: MemWriter;
  constructor(start: number, len: number, read?: MemReader, write?: MemWriter) {
    this.start = start;
    this.len = len;
    this.read = read;
    this.write = write;
  }
}

export class ROM {
  name: string;
  mem: MemBlock;
  constructor(name: string, mem: MemBlock) {
    this.name = name;
    this.mem = mem;
  }
}
