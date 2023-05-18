import "./ws-events"
import { type WSEventHandler } from "ws-events";
export declare const Delete: unique symbol;
export declare const END_DEPTH: unique symbol;
export declare const internal: unique symbol;
export declare const internalID: unique symbol;
export declare const From: unique symbol;
export type Serializer = {
    serialize(obj: any): any;
    deserialize(str: any): any;
};
export declare function addSerializerDeserializer(fn: Function, serializer: Serializer): void;
/**
 * Returns an object containing all property descriptors of the given object
 * and its prototype chain.
 * @param obj - The object to get property descriptors from.
 * @returns An object containing all property descriptors of the given object
 *          and its prototype chain.
 */
export declare function getAllPropertyDescriptor(obj: object): {
    [key: string]: PropertyDescriptor;
    [key: number]: PropertyDescriptor;
    [key: symbol]: PropertyDescriptor;
};
/**
 *
 * Maps over an object Recursively using mapfn creating a copy
 * and returning the new object
 * @param object - The object to map
 * @param mapFN - The function for modifying the object
 * @returns A new object with modified data
 */
export declare function objectMap(object: any, mapFN: ((value: any, path: (string | number | symbol)[], object: object) => typeof Delete | [string | number | symbol, any] | [string | number | symbol, any, typeof END_DEPTH])): any;
/**
 * Serializes a JavaScript object into a JSON string, with support for native objects and functions.
 * @param obj - The object to serialize.
 * @param from - The direction of the serialization, either "front" or "back". Defaults to "front".
 * @param wse - The WSEventHandler used to serialize and deserialize functions.
 * @returns A JSON string representing the serialized object.
 */
export declare function serialize(obj: any, from: "front" | "back" | undefined, wse: WSEventHandler): string;
export declare function deserialize(str: string, from: "front" | "back" | undefined, wse: WSEventHandler): any;
declare let wse: Promise<WSEventHandler> | null;
export declare function callNode(id: string, share: any[], update?: (...args: any[]) => any): Promise<unknown> | undefined;
export default function node<T>(nodeFunction: () => T): Promise<T>;
export { wse };
