// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.2.1
//   protoc               v5.26.1
// source: protos/fishjam/peer_notifications.proto

/* eslint-disable */
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";

export const protobufPackage = "fishjam";

/** Defines any type of message sent between FJ and a peer */
export interface PeerMessage {
  authenticated?: PeerMessage_Authenticated | undefined;
  authRequest?: PeerMessage_AuthRequest | undefined;
  mediaEvent?: PeerMessage_MediaEvent | undefined;
  rtcStatsReport?: PeerMessage_RTCStatsReport | undefined;
}

/** Response sent by FJ, confirming successfull authentication */
export interface PeerMessage_Authenticated {
}

/** Request sent by peer, to authenticate to FJ server */
export interface PeerMessage_AuthRequest {
  token: string;
}

/** Any type of WebRTC messages passed betweend FJ and peer */
export interface PeerMessage_MediaEvent {
  data: string;
}

/**
 * PeerConnection stats sent by peer
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport#the_statistic_types
 */
export interface PeerMessage_RTCStatsReport {
  data: string;
}

function createBasePeerMessage(): PeerMessage {
  return { authenticated: undefined, authRequest: undefined, mediaEvent: undefined, rtcStatsReport: undefined };
}

export const PeerMessage: MessageFns<PeerMessage> = {
  encode(message: PeerMessage, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.authenticated !== undefined) {
      PeerMessage_Authenticated.encode(message.authenticated, writer.uint32(10).fork()).join();
    }
    if (message.authRequest !== undefined) {
      PeerMessage_AuthRequest.encode(message.authRequest, writer.uint32(18).fork()).join();
    }
    if (message.mediaEvent !== undefined) {
      PeerMessage_MediaEvent.encode(message.mediaEvent, writer.uint32(26).fork()).join();
    }
    if (message.rtcStatsReport !== undefined) {
      PeerMessage_RTCStatsReport.encode(message.rtcStatsReport, writer.uint32(34).fork()).join();
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PeerMessage {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePeerMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }

          message.authenticated = PeerMessage_Authenticated.decode(reader, reader.uint32());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }

          message.authRequest = PeerMessage_AuthRequest.decode(reader, reader.uint32());
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }

          message.mediaEvent = PeerMessage_MediaEvent.decode(reader, reader.uint32());
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }

          message.rtcStatsReport = PeerMessage_RTCStatsReport.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PeerMessage {
    return {
      authenticated: isSet(object.authenticated) ? PeerMessage_Authenticated.fromJSON(object.authenticated) : undefined,
      authRequest: isSet(object.authRequest) ? PeerMessage_AuthRequest.fromJSON(object.authRequest) : undefined,
      mediaEvent: isSet(object.mediaEvent) ? PeerMessage_MediaEvent.fromJSON(object.mediaEvent) : undefined,
      rtcStatsReport: isSet(object.rtcStatsReport)
        ? PeerMessage_RTCStatsReport.fromJSON(object.rtcStatsReport)
        : undefined,
    };
  },

  toJSON(message: PeerMessage): unknown {
    const obj: any = {};
    if (message.authenticated !== undefined) {
      obj.authenticated = PeerMessage_Authenticated.toJSON(message.authenticated);
    }
    if (message.authRequest !== undefined) {
      obj.authRequest = PeerMessage_AuthRequest.toJSON(message.authRequest);
    }
    if (message.mediaEvent !== undefined) {
      obj.mediaEvent = PeerMessage_MediaEvent.toJSON(message.mediaEvent);
    }
    if (message.rtcStatsReport !== undefined) {
      obj.rtcStatsReport = PeerMessage_RTCStatsReport.toJSON(message.rtcStatsReport);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PeerMessage>, I>>(base?: I): PeerMessage {
    return PeerMessage.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PeerMessage>, I>>(object: I): PeerMessage {
    const message = createBasePeerMessage();
    message.authenticated = (object.authenticated !== undefined && object.authenticated !== null)
      ? PeerMessage_Authenticated.fromPartial(object.authenticated)
      : undefined;
    message.authRequest = (object.authRequest !== undefined && object.authRequest !== null)
      ? PeerMessage_AuthRequest.fromPartial(object.authRequest)
      : undefined;
    message.mediaEvent = (object.mediaEvent !== undefined && object.mediaEvent !== null)
      ? PeerMessage_MediaEvent.fromPartial(object.mediaEvent)
      : undefined;
    message.rtcStatsReport = (object.rtcStatsReport !== undefined && object.rtcStatsReport !== null)
      ? PeerMessage_RTCStatsReport.fromPartial(object.rtcStatsReport)
      : undefined;
    return message;
  },
};

function createBasePeerMessage_Authenticated(): PeerMessage_Authenticated {
  return {};
}

export const PeerMessage_Authenticated: MessageFns<PeerMessage_Authenticated> = {
  encode(_: PeerMessage_Authenticated, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PeerMessage_Authenticated {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePeerMessage_Authenticated();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): PeerMessage_Authenticated {
    return {};
  },

  toJSON(_: PeerMessage_Authenticated): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<PeerMessage_Authenticated>, I>>(base?: I): PeerMessage_Authenticated {
    return PeerMessage_Authenticated.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PeerMessage_Authenticated>, I>>(_: I): PeerMessage_Authenticated {
    const message = createBasePeerMessage_Authenticated();
    return message;
  },
};

function createBasePeerMessage_AuthRequest(): PeerMessage_AuthRequest {
  return { token: "" };
}

export const PeerMessage_AuthRequest: MessageFns<PeerMessage_AuthRequest> = {
  encode(message: PeerMessage_AuthRequest, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PeerMessage_AuthRequest {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePeerMessage_AuthRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }

          message.token = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PeerMessage_AuthRequest {
    return { token: isSet(object.token) ? globalThis.String(object.token) : "" };
  },

  toJSON(message: PeerMessage_AuthRequest): unknown {
    const obj: any = {};
    if (message.token !== "") {
      obj.token = message.token;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PeerMessage_AuthRequest>, I>>(base?: I): PeerMessage_AuthRequest {
    return PeerMessage_AuthRequest.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PeerMessage_AuthRequest>, I>>(object: I): PeerMessage_AuthRequest {
    const message = createBasePeerMessage_AuthRequest();
    message.token = object.token ?? "";
    return message;
  },
};

function createBasePeerMessage_MediaEvent(): PeerMessage_MediaEvent {
  return { data: "" };
}

export const PeerMessage_MediaEvent: MessageFns<PeerMessage_MediaEvent> = {
  encode(message: PeerMessage_MediaEvent, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.data !== "") {
      writer.uint32(10).string(message.data);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PeerMessage_MediaEvent {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePeerMessage_MediaEvent();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }

          message.data = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PeerMessage_MediaEvent {
    return { data: isSet(object.data) ? globalThis.String(object.data) : "" };
  },

  toJSON(message: PeerMessage_MediaEvent): unknown {
    const obj: any = {};
    if (message.data !== "") {
      obj.data = message.data;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PeerMessage_MediaEvent>, I>>(base?: I): PeerMessage_MediaEvent {
    return PeerMessage_MediaEvent.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PeerMessage_MediaEvent>, I>>(object: I): PeerMessage_MediaEvent {
    const message = createBasePeerMessage_MediaEvent();
    message.data = object.data ?? "";
    return message;
  },
};

function createBasePeerMessage_RTCStatsReport(): PeerMessage_RTCStatsReport {
  return { data: "" };
}

export const PeerMessage_RTCStatsReport: MessageFns<PeerMessage_RTCStatsReport> = {
  encode(message: PeerMessage_RTCStatsReport, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.data !== "") {
      writer.uint32(10).string(message.data);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PeerMessage_RTCStatsReport {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePeerMessage_RTCStatsReport();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }

          message.data = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PeerMessage_RTCStatsReport {
    return { data: isSet(object.data) ? globalThis.String(object.data) : "" };
  },

  toJSON(message: PeerMessage_RTCStatsReport): unknown {
    const obj: any = {};
    if (message.data !== "") {
      obj.data = message.data;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PeerMessage_RTCStatsReport>, I>>(base?: I): PeerMessage_RTCStatsReport {
    return PeerMessage_RTCStatsReport.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PeerMessage_RTCStatsReport>, I>>(object: I): PeerMessage_RTCStatsReport {
    const message = createBasePeerMessage_RTCStatsReport();
    message.data = object.data ?? "";
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export interface MessageFns<T> {
  encode(message: T, writer?: BinaryWriter): BinaryWriter;
  decode(input: BinaryReader | Uint8Array, length?: number): T;
  fromJSON(object: any): T;
  toJSON(message: T): unknown;
  create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
  fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}
