// Reexport your entry 
//@ts-nocheck: Element implicitly has an 'any' type error

import WsEvents from "./ws-events"
/** @typedef {import("./ws-events").WSEventHandler} WSEventHandler */
/** @typedef {import("./ws-events").WebSocketLike} WebSocketLike */
/** @typedef {{
    cache?: Record<number, any>,
    functionRef?: Map<number, function>,
    functionMap?: Map<number, WeakRef<function>>,
    weakRef?: WeakMap<any, any>
 }} CacheData */


export const Delete = Symbol("Delete the current key")
export const END_DEPTH = Symbol("Disallows the map to go deeper in the object")
export const internal = Symbol("internal value")
export const From = Symbol("from side")

//! share map to serialize and deserialize objects which cannot be serialized by JSON.stringify
globalThis.shareMap = new Map()
/**
 * @type {Map<Function, {
        serialize(obj: any): any,
        deserialize(str: any): any
  }>}
 */
let shareMap = globalThis.shareMap
shareMap.set(
    Date,
    {
        serialize(obj) {
            return obj.valueOf()
        },
        deserialize(str) {
            return new Date(parseInt(str))
        }
    }
)
shareMap.set(
    BigInt,
    {
        serialize(obj) {
            return obj.toString()
        },
        deserialize(str) {
            return BigInt(str)
        }
    }
)
shareMap.set(
    Set,
    {
        serialize(obj) {
            return Array.from(obj)
        },
        deserialize(str) {
            return new Set(str)
        }
    }
)
shareMap.set(
    Map,
    {
        serialize(obj) {
            return Array.from(obj)
        },
        deserialize(str) {
            return new Map(str)
        }
    }
)

/** @typedef {{serialize(obj: any): any, deserialize(str: any): any}} Serializer */

/**
 * @description Adds a class to be shared in a different way than other objects
 * @param {Function} fn - The class to be shared in a different way than other objects
 * @param {Serializer} serializer = The serializer functions to use
 */
export function addSerializerDeserializer(fn, serializer) {
    globalThis.shareMap.set(fn, serializer)
}

/**
 * @description Returns an object containing all property descriptors of the given object
 * and its prototype chain.
 * @param {object} obj - The object to get property descriptors from.
 * @returns An object containing all property descriptors of the given object
 *          and its prototype chain.
 */
export function getAllPropertyDescriptor(obj) {
    let current = obj
    /** @type {Record<string | number | symbol, PropertyDescriptor>} */
    let descriptor = {}

    if(current == null) return descriptor

    // If the object is an instance of Object, return its property descriptors
    if(current.constructor === Object) {
        return Object.getOwnPropertyDescriptors(current)
    }

    // Traverse the prototype chain and merge all property descriptors
    while(current?.constructor !== Object && current != null) {
        descriptor = {...Object.getOwnPropertyDescriptors(current), ...descriptor}
        current = Object.getPrototypeOf(current)
    }
    /** @type {any} */
    let descriptorTemp = descriptor
    delete descriptorTemp.constructor
    // Return the merged property descriptors
    return descriptor
}

/** 
 * @typedef {(
        value: any,
        path: (string | number | symbol)[],
        current: object,
        object: object
    ) => typeof Delete 
        | [string | number | symbol, any] 
        | [string | number | symbol, any, typeof END_DEPTH]
    } ObjectMapFN
 */

function *getIDs() {
    let id = 0
    while(true) {
        yield id
        id++
    }
}
const ids = getIDs()
const callIds = getIDs()
/** @type {Record<number, any>} */
const cache = {}
const weakRefMain = new WeakMap()
/** @type {Map<number, function>} */
const funcIndicies = new Map()
/** @type {Map<number, WeakRef<Function>>} */
const funcRef = new Map()


/**
 * Serializes a JavaScript object into a JSON string, with support for native objects and functions.
 * @param {any} obj - The object to serialize.
 * @param {"front" | "back"} from - The direction of the serialization, either "front" or "back". Defaults to "front".
 * @param {WSEventHandler} wse - The WSEventHandler used to serialize and deserialize functions.
 * @returns A JSON string representing the serialized object.
 */
export function serialize(
    obj, 
    from, 
    wse, 
    cacheMain = cache,
    functionIndicies = funcIndicies,
    functionMap = funcRef,
    weakRef = weakRefMain
) {
    //where we going from
    const current = from === "back" ? "front" : "back"
    //meta object that holds meta info of the serialized object for deserealization
    /**
     * @type {[
        (string | number | symbol)[],
        {type: string, id?: number, from: "front" | "back", value?: any}
        | {type: "class", id?: number, from: "front" | "back", classID: number, value?: any}
     ][]}
     */
    const meta = []
    /** @type {string[]} */
    const stringifyPath = []
    /** @type {any[]} */
    const prevObject = []
    /** @type {any[]} */
    const prevTrueObject = []
    const value = JSON.stringify(obj, function (key, value)  {
        if(prevTrueObject.includes(value)) return null
        if(this != null) {
            let objectindex = prevObject.indexOf(this)
            prevObject.splice(objectindex + 1)
            prevTrueObject.splice(objectindex + 1)
            stringifyPath.splice(objectindex)
        }
        if(key == '' || key == null) {
            if(typeof value === 'bigint') {
                meta.push([[], {type: "bigint", from, value: value.toString()}])
                return ""
            }
        } else
            stringifyPath.push(key)
        if(value?.[From] !== from && value?.[From] != null) {
            //Add it's detail to meta
            meta.push([[...stringifyPath], {type: "native", from: value?.[From], id: weakRef.get(value)}])
            const path = stringifyPath.join(".")
            stringifyPath.pop()
            return path
        }
        if(typeof value === "function") {
            if(functionIndicies.size < 1) {
                wse.on("func-check", str => {
                    for(let [key, ref] of functionMap) {
                        if(ref.deref() != null) functionMap.delete(key)
                    }
                    
                    const funcs = new Set([...JSON.parse(str), ...functionMap.keys()])
                    for (const [key] of functionIndicies) {
                        if(!funcs.has(key)) {
                            functionIndicies.delete(key)
                        }
                    }
                    wse.off(`${id}-${from}`, value)
                })
            }
            const id = weakRef.get(value) ?? ids.next().value
            functionMap.set(id, new WeakRef(value))
            cacheMain[id] = value
            meta.push([[...stringifyPath], {type: "function", id, from}])
            const path = stringifyPath.join(".")
            stringifyPath.pop()
            weakRef.set(value, id)
            let self = prevTrueObject.at(-1)
            /**
             * @param {Object} data
             * @param {number} data.id
             * @param {any} data.args
             */
            let cb = async ({id, args}) => {
                const deserializedArgs = deserialize(
                    args,
                    current,
                    wse,
                    cacheMain,
                    functionMap,
                    functionIndicies,
                    weakRef
                )
                if(self?.constructor === Object) {
                    wse.emit(`${id}-${from}`, serialize(
                        await value(...deserializedArgs),
                        from,
                        wse,
                        cacheMain,
                        functionIndicies,
                        functionMap,
                        weakRef
                    ))
                    return
                }
                wse.emit(`${id}-${from}`, serialize(
                    await value.call(self, ...deserializedArgs), 
                    from,
                    wse,
                    cacheMain,
                    functionIndicies,
                    functionMap,
                    weakRef
                ))
            }
        if(weakRef.get(value) != null && functionIndicies.has(id)) {
            /** @type {any} */
            let prevCB = functionIndicies.get(id)
            wse.off(`${id}-${from}`, prevCB)
        }

            functionIndicies.set(id, cb)
            wse.on(`${id}-${from}`, cb)
            return path
        }
        
        if((typeof value === "object" && value != null) || typeof value === "bigint") {
            const {serialize: classSerialize} = globalThis.shareMap.get(value.constructor) ?? {}
            if(typeof classSerialize === "function") {
                const id = weakRef.get(value) ?? ids.next().value
                if(typeof value !== "bigint") weakRef.set(value, id)
                cacheMain[id] = value
                let serializedValue = classSerialize(value)
                if(typeof serializedValue !== "object") {
                    const path = stringifyPath.join(".")
                    prevObject.push(serializedValue)
                    prevTrueObject.push(value)
                    meta.push([[...stringifyPath], {
                        type: "class", 
                        id, 
                        from, 
                        classID: [
                            ...globalThis.shareMap
                        ].findIndex(
                            ([cl]) => cl === value.constructor
                        ),
                        value: serializedValue
                    }])
                    stringifyPath.pop()

                    return path
                }
                meta.push([[...stringifyPath], {
                    type: "class", 
                    id, 
                    from, 
                    classID: [
                        ...globalThis.shareMap
                    ].findIndex(
                        ([cl]) => cl === value.constructor
                    )
                }])
                return serializedValue
            }
            prevTrueObject.push(value)
            getAllPropertyDescriptor(value)
            if(value.constructor !== Object && !Array.isArray(value)) {
                const resultObject = {}
                const props = getAllPropertyDescriptor(value)
                for(let [key, value] of Object.entries(props)) {
                    Object.defineProperty(resultObject, key, {
                        ...value,
                        enumerable: true,
                    })
                }
                let id = weakRef.get(value) ?? ids.next().value
                weakRef.set(value, id)
                cacheMain[id] = value
                meta.push([[...stringifyPath], {id, type: "unknowClass", from}])
                prevObject.push(resultObject)
                return resultObject
            }
            prevObject.push(value)
            if(Object.values(value).length === 0) {
                meta.push([[...stringifyPath], {type: "emptyObjectOrArray", from, value}])
                                return stringifyPath.join(".")
            }
            return value
        }
        meta.push([[...stringifyPath], {type: "primitive", from, value}])
        const path = stringifyPath.join(".")
                stringifyPath.pop()
        return path

    }, 4)
    //Map over the object to allow it to be serialized by JSON
    return JSON.stringify(
        {
            meta,
            value
        },
        null,
        4
    )
}

class StringifyPathValue {
    /**
     * @param {string} path
     * @param {any} value
     */
    constructor(path, value) {
        this.path = path
        this.value = value
    }
}



/**
 * @param {string} str
 * @param {"front" | "back"} from
 * @param {WSEventHandler} wse
 *
 */

export function deserialize(
    str, 
    from, 
    wse,
    cacheMain = cache,
    functionRef = funcRef,
    functionMap = funcIndicies,
    weakRef = weakRefMain
) {
    const current = from === "back" ? "front" : "back"
    /**
     * @type {{
        meta: [
            (string | number | symbol)[],
            {type: string, id?: number, from: "front" | "back", classID?: number, value?: any}
        ][],
        value: any
     }}
     */
    const {meta, value: valueStr} = JSON.parse(str)
    if(meta.length === 1 && meta[0][0].length === 0) {
        if(meta[0][1].type === "bigint") return BigInt(meta[0][1].value)
    }
    const result = valueStr == null ? valueStr : JSON.parse(valueStr, (key, rawValue) => {
        /** @type {string[]} */
        let path = []
        /** @type {any} */
        let valueMain = null
        if(typeof rawValue === "object") {
            let strPathValues = rawValue == null ? [] : Object.values(rawValue)
            path = strPathValues[0]?.path.split(".") ?? []
            path.pop()
            valueMain = Array.isArray(rawValue) ? [] : {}
            for(let strPathValue of strPathValues) {
                valueMain[strPathValue.path.split(".").at(-1) ?? ""] = strPathValue.value
            }
        } else {
            path = rawValue?.split(".") ?? []
        }
        if(key == null || key.length === 0) path = []
                const keyMeta = meta.find(
            ([metaPath]) =>
                metaPath.length === path.length
                && (
                    metaPath.every((key, index) => key == path[index])
                    || metaPath.length === 0
                )
        )?.[1]
                if(keyMeta?.from !== from) {
            if(keyMeta?.id != null) {
                return new StringifyPathValue(path.join("."), cacheMain[keyMeta.id])
            }
        }
        if(keyMeta?.type === "function") {
            const id = keyMeta.id
            /**
             * @param {...any} args
             */
            const value = function (...args) {
                const callID = callIds.next().value
                wse.emit(`${id}-${from}`, {id: callID, args: serialize(
                    args,
                    current,
                    wse,
                    cacheMain,
                    functionMap,
                    functionRef,
                    weakRef
                )})
                return new Promise((resolve) => {
                    /**
                     * @param {string} returned
                     */
                    function onReturn(returned) {
                        wse.off(`${id}-${from}`, onReturn)
                        resolve(deserialize(
                            returned,
                            from,
                            wse,
                            cacheMain,
                            functionRef,
                            functionMap,
                            weakRef
                        ))
                    }
                    wse.on(`${callID}-${from}`, onReturn)
                    wse.emit("func-check", JSON.stringify([...functionRef].map(([key, ref]) => [key, ref.deref()])
                        .filter(([, value]) => value != null)
                        .map(([key]) => key)))
                    for(let [key, ref] of funcRef) {
                        if(ref.deref() == null) funcRef.delete(key)
                    }
                })
            }
            try {
                /** @type {any} */
                let valueTemp = value
                weakRef.set(value, id)
                functionRef.set(id ?? 0, new WeakRef(value))
                valueTemp[From] = from
            } catch {}
            return new StringifyPathValue(path.join("."), value)
        } 
        if(keyMeta?.type === "class") {
            const id = keyMeta.id
            const classID = keyMeta.classID ?? 0 
            const value = keyMeta.value
            const {deserialize: classDeserialize} = [...globalThis.shareMap][classID][1] ?? {}
            if(typeof classDeserialize === "function") {
                const serializedValue = classDeserialize(value)
                if(typeof serializedValue !== "bigint") {
                    try {
                        weakRef.set(rawValue, id)
                        serializedValue[From] = keyMeta.from
                    } catch {}
                }
                return new StringifyPathValue(path.join("."), serializedValue)
            }
        }
        let value = keyMeta?.value ?? valueMain
        if(keyMeta?.id != null && (value != null || valueMain) && value.from === from) {
            try {
                weakRef.set(value, keyMeta.id)
                value[From] = from
            } catch {}
        }
        return new StringifyPathValue(path.join("."), value ?? valueMain)
        
    })
        return result.value
}

/**
 * @param {unknown} ws
 * @returns {asserts ws is WebSocketLike}
 */
export function ensureWSLike(ws) {
    if(ws == null) throw TypeError("ws must be an object")
    if(typeof ws !== "object") throw TypeError("ws must be an object")
    if(!("send" in ws)) throw TypeError("ws must have a send method")
    if(!("addEventListener" in ws)) throw TypeError("ws must have an addEventListener method")
    if(typeof ws.addEventListener !== "function") throw TypeError("ws must have a send method")    
    if(typeof ws.send !== "function") throw TypeError("ws must have an addEventListener method")    
}

/**
 * @type {Promise<WSEventHandler> | null}
 */
let wse
if(typeof window !== "undefined") {
    try {
        // @ts-ignore
        wse = import(":__internal_full_client_server_browserWSConfig__")
        .then(({wsInit}) => wsInit()).then((ws) => {
            ensureWSLike(ws)
            return ws
        }).catch((err) => {
            if(import.meta.env.MODE === "development") if(err instanceof TypeError) {
                if(err.message.includes("is not a function")) 
                    console.warn("wsInit function must be exported, using default WebSocket instead")
                else 
                    console.warn("wsInit must return a WebSocketLike Object, using default WebSocket instead")
            } 
            else
                console.warn("browserWSConfig not provided using default WebSocket")
            let url = new URL(window.location.href)
            url.protocol = url.protocol.replace('http', 'ws');
            return new WebSocket(url)
        }).then(ws => {
            let wse = new Promise(resolve => {

                ws.onopen = function () {
                    resolve(WsEvents(ws))
                }
            })
            return wse
        })
    } catch {
    }
}

/**
 * @param {string} id
 * @param {any[]} share
 * @param {(...args: any[]) => any} update
 */

function callNode(id, share, update = () => {}) {
    if(wse == null) return
    
    return new Promise(async (resolve, reject) => {
        let timeout = setTimeout(() => {
            reject(new Error("timeout"))
        }, globalThis.__internal_full_client_server_timeout__)
        if(wse == null) return
        const callId = callIds.next().value
        ;(await wse).emit(id, serialize([callId, ...share, /** @type {(...args: any[]) => void} */ (...args) => {
            update(...args)
        }], "front", await wse))
        /**
         * @param {string} data
         */
        async function returned(data) {
            clearTimeout(timeout)
            if(wse == null) return
            resolve(deserialize(data, "back", await wse))
            ;(await wse)?.off(`${id}-${callId}`, returned)
        }
        ;(await wse).on(`${id}-${callId}`, returned)
    })
}
export {callNode}


/**
 * @template T
 * @param {() => T} nodeFunction
 * @return {Promise<Awaited<T>>}
 */
export default async function node(nodeFunction) {
    return await nodeFunction()
}

export {wse}
