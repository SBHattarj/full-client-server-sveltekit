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

/**
 * 
 * @description Maps over an object Recursively using mapfn creating a copy 
 * and returning the new object
 * @param {any} object - The object to map
 * @param {ObjectMapFN} mapFN - The function for modifying the object
 * @returns A new object with modified data
 */
export function objectMap(object, mapFN) {
    // if given object is an premitive type then can't map through it so return
    if(typeof object !== "object") return object

    // get keys of the object
    let keysMap = Array.isArray(object) ? [Object.keys(object)] : [Object.keys(getAllPropertyDescriptor(object))]

    // current object property depth and property index
    let currentLevel = 0
    let currentIndex = 0
    
    //if there is no keys in the object then can't map so return an copy of object
    if(keysMap[currentLevel].length === 0) 
        return Array.isArray(object) ? [...object] : {...object}

    // the path is the array of properties that lead to current property
    let path = [keysMap[currentLevel][currentIndex]]
    // the objects through which we get to current property
    /** @type {any[]} */
    let prevObjects = [Object.defineProperties({}, getAllPropertyDescriptor(object))]

    // indices of the keys in path
    let prevKeyIndices = [currentIndex]

    //current key
    let current = prevObjects.at(-1)

    //the new object
    /** @type {any} */
    let result = Array.isArray(object) ? [] : {}

    // the objects that lead to the current property in result
    /** @type {any[]} */
    let prevResults = [result]

    // using loop to avoid stack overflow
    while(true) {
        const mapFNResultNormal = mapFN(current[path.at(-1) ?? 0], [...path], current, object)
        
        //if Delete symbol sent back then continuing meaning the key is deleted
        //from the object
        if(mapFNResultNormal === Delete) {
            continue
        }

        //checking if there is a circular reference then we get the index for the
        //object reference
        const circularIndex = prevObjects.findIndex(
            prevObject => prevObject === mapFNResultNormal[1]
        )
        const key = mapFNResultNormal[0]
        const mapFNResult = 
            circularIndex > -1 
            ? prevResults[circularIndex] 
            : mapFNResultNormal[1]
        
        //setting the key on the current result object
        //that is the last object in prevResults 
        prevResults.at(-1)[key] = mapFNResult
        

        //if the result is an object and is not null we continue to map through it
        if(
            typeof mapFNResult === "object" 
            && mapFNResult != null
        ) {
            const resultKeys = Array.isArray(mapFNResult) ? Object.keys(mapFNResult) : Object.keys(getAllPropertyDescriptor(mapFNResult))

            //Again if resultKeys has no elements cant map through it
            if(
                resultKeys.length > 0 
                && !(prevResults
                    .findIndex(
                        prevResult => prevResult === mapFNResult
                    ) > -1)
                && mapFNResultNormal[2] !== END_DEPTH
            ) {
                //We add the objects to prev objects to refer back to
                prevObjects.push(Object.defineProperties({}, getAllPropertyDescriptor(mapFNResult)))
                prevResults.push(mapFNResult)
    
                //same for prev indices
                prevKeyIndices.push(currentIndex)
    
                //increment depth level
                currentLevel++
                currentIndex = 0
    
                //add current key to the key map
                keysMap.push(resultKeys)
                //add key to path
                path.push(keysMap[currentLevel][currentIndex])
                //get current object
                current = prevObjects.at(-1)
                continue
            }
        }
        //get next index of key
        currentIndex++

        //if current index is more than last index of all keys then go back a level
        if(currentIndex > (keysMap[currentLevel].length - 1)) {
            currentLevel--
            path.pop()
            
            //if current level is less than 0 then return
            if(currentLevel < 0) {
                return result
            }
            
            //removing current object as no longer needed
            prevObjects.pop()
            //removing current result object as no longer needed to modify
            prevResults.pop()
            
            //getting last used index
            currentIndex = prevKeyIndices.pop() ?? 0
            //remove last key
            keysMap.pop()
            //remove last key from path
            path.pop()

            //if current index is still to large do same until current level
            //is less than the length or level is less than 0
            while((keysMap[currentLevel].length - 1) <= currentIndex) {
                currentLevel--
                if(currentLevel < 0) {
                    return result
                }
                keysMap.pop()
                path.pop()
                prevObjects.pop()
                prevResults.pop()
                currentIndex = prevKeyIndices.pop() ?? 0
            }
            currentIndex++
            path.push(keysMap[currentLevel][currentIndex])
            current = prevObjects.at(-1)
            continue
        }
        path[path.length - 1] = keysMap[currentLevel][currentIndex]
    }
}

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
        {type: string, id?: number, from: "front" | "back"}
        | {type: "class", id?: number, from: "front" | "back", classID: number}
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
                meta.push([[], {type: "bigint", from}])
                return value.toString()
            }
        } else
            stringifyPath.push(key)
        if(value?.[From] !== from && value?.[From] != null) {
            //Add it's detail to meta
            meta.push([[...stringifyPath], {type: "native", from: value?.[From], id: weakRef.get(value)}])
            stringifyPath.pop()
            return "native"
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
            return `id-${from}=${id}`
        }
        
        if((typeof value === "object" && value != null) || typeof value === "bigint") {
            const {serialize: classSerialize} = globalThis.shareMap.get(value.constructor) ?? {}
            if(typeof classSerialize === "function") {
                const id = weakRef.get(value) ?? ids.next().value
                if(typeof value !== "bigint") weakRef.set(value, id)
                cacheMain[id] = value
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
                let serializedValue = classSerialize(value)
                if(typeof serializedValue !== "object") {
                    stringifyPath.pop()
                }
                if(typeof serializedValue !== "object") {
                    prevObject.push(serializedValue)
                    prevTrueObject.push(value)
                }
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
            
            return value
        }
        stringifyPath.pop()
        return value

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
            {type: string, id?: number, from: "front" | "back", classID?: number}
        ][],
        value: any
     }}
     */
    const {meta, value: valueStr} = JSON.parse(str)
    const value = valueStr == null ? valueStr : JSON.parse(valueStr)
    if(meta.length === 1 && meta[0][0].length === 0) {
        if(meta[0][1].type === "bigint") return BigInt(value)
    }
    return objectMap(value, (value, path) => {
        /** @type {string | number | symbol} */
        const key = path.at(-1) ?? ""
        const keyMeta = meta.find(
            ([metaPath]) => 
                metaPath.length === path.length 
                && metaPath.every((key, index) => key == path[index])
        )?.[1]
        if(keyMeta?.from !== from) {
            if(keyMeta?.id != null) {
                return [key, cacheMain[keyMeta.id]]
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
            return [key, value]
        }
        if(keyMeta?.type === "class") {
            const id = keyMeta.id
            const classID = keyMeta.classID ?? 0 
            const {deserialize: classDeserialize} = [...globalThis.shareMap][classID][1] ?? {}
            if(typeof classDeserialize === "function") {
                const serializedValue = classDeserialize(value)
                if(typeof serializedValue !== "bigint") {
                    try {
                        weakRef.set(value, id)
                        serializedValue[From] = keyMeta.from
                    } catch {}
                }
                return [key, serializedValue]
            }
        }
        if(keyMeta?.id != null && value != null && value.from === from) {
            try {
                weakRef.set(value, keyMeta.id)
                value[From] = from
            } catch {}
        }
        return [key, value]
    })
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
        wse = import(/* @vite-ignore */`${
            import.meta.env.__internal_full_client_server_cwd__
        }/${
            import.meta.env.__internal_full_client_server_import__
        }`).then(({wsInit}) => wsInit()).then((ws) => {
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
