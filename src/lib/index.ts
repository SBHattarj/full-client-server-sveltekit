// Reexport your entry 
//@ts-nocheck: Element implicitly has an 'any' type error

import WsEvents, { type WSEventHandler } from "ws-events"
import { BROWSER } from "esm-env";
export const Delete = Symbol("Delete the current key")
export const END_DEPTH = Symbol("Disallows the map to go deeper in the object")
export const internal = Symbol("internal value")
export const internalID = Symbol("internal ID")
export const From = Symbol("from side")

//! share map to serialize and deserialize objects which cannot be serialized by JSON.stringify
globalThis.shareMap = new Map()
shareMap.set(
    Date,
    {
        serialize(obj: Date) {
            return obj.valueOf()
        },
        deserialize(str: any) {
            return new Date(parseInt(str))
        }
    }
)
shareMap.set(
    BigInt,
    {
        serialize(obj: BigInt) {
            return obj.toString()
        },
        deserialize(str: string) {
            return BigInt(str)
        }
    }
)
shareMap.set(
    Set,
    {
        serialize(obj: Set<any>) {
            return Array.from(obj)
        },
        deserialize(str: any) {
            return new Set(str)
        }
    }
)
shareMap.set(
    Map,
    {
        serialize(obj: Map<any, any>) {
            return Array.from(obj)
        },
        deserialize(str: any) {
            return new Map(str)
        }
    }
)

export type Serializer = {serialize(obj: any): any, deserialize(str: any): any}

export function addSerializerDeserializer(fn: Function, serializer: Serializer) {
    globalThis.shareMap.set(fn, serializer)
}

/**
 * Returns an object containing all property descriptors of the given object
 * and its prototype chain.
 * @param obj - The object to get property descriptors from.
 * @returns An object containing all property descriptors of the given object
 *          and its prototype chain.
 */
export function getAllPropertyDescriptor(obj: object) {
    let current = obj
    let descriptor = {} as {[key: string | number | symbol]: PropertyDescriptor}

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
    delete (descriptor as any).constructor
    // Return the merged property descriptors
    return descriptor
}

/**
 * 
 * Maps over an object Recursively using mapfn creating a copy 
 * and returning the new object
 * @param object - The object to map
 * @param mapFN - The function for modifying the object
 * @returns A new object with modified data
 */
export function objectMap(object: any, mapFN: ((value: any, path: (string | number | symbol)[], current: object, object: object) => typeof Delete | [string | number | symbol, any] | [string | number | symbol, any, typeof END_DEPTH])) {
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
    let prevObjects = [Object.defineProperties({}, getAllPropertyDescriptor(object))] as any[]

    // indices of the keys in path
    let prevKeyIndices = [currentIndex]

    //current key
    let current = prevObjects.at(-1)

    //the new object
    let result: any = Array.isArray(object) ? [] : {}

    // the objects that lead to the current property in result
    let prevResults = [result] as any[]

    // using loop to avoid stack overflow
    while(true) {
        const mapFNResultNormal = mapFN(current[path.at(-1)!], [...path], current, object)
        
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
            currentIndex = prevKeyIndices.pop()!
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
                currentIndex = prevKeyIndices.pop()!
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
const cache: {[key: number]: any} = {}

/**
 * Serializes a JavaScript object into a JSON string, with support for native objects and functions.
 * @param obj - The object to serialize.
 * @param from - The direction of the serialization, either "front" or "back". Defaults to "front".
 * @param wse - The WSEventHandler used to serialize and deserialize functions.
 * @returns A JSON string representing the serialized object.
 */
export function serialize(
    obj: any, 
    from: "front" | "back" = "front", 
    wse: WSEventHandler, 
    cacheMain = cache
) {
    //where we going from
    const current = from === "back" ? "front" : "back"
    //meta object that holds meta info of the serialized object for deserealization
    const meta: [
        (string | number | symbol)[], 
        {type: string, id?: number, from: "front" | "back"}
        | {type: "class", id?: number, from: "front" | "back", classID: number}][] 
        = []
    const stringifyPath: string[] = []
    const prevObject: any[] = []
    const prevTrueObject: any[] = []
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
            meta.push([[...stringifyPath], {type: "native", from: value?.[From], id: value[internalID]}])
            stringifyPath.pop()
            return "native"
        }
        if(typeof value === "function") {
            const id = value[internalID] ?? ids.next().value!
            cacheMain[id] = value
            meta.push([[...stringifyPath], {type: "function", id, from}])
            stringifyPath.pop()
            try {
                value[internalID] = id
            } catch {}
            let self = prevTrueObject.at(-1)
            wse.on(`${id}-${from}`, async ({id, args}) => {
                const deserializedArgs = deserialize(args, current, wse)
                if(self?.constructor === Object) {
                    wse.emit(`${id}-${from}`, serialize(await value(...deserializedArgs), from, wse))
                    return
                }
                wse.emit(`${id}-${from}`, serialize(await value.call(self, ...deserializedArgs), from, wse))
            })
            return `id-${from}=${id}`
        }
        
        if((typeof value === "object" && value != null) || typeof value === "bigint") {
            const {serialize: classSerialize} = globalThis.shareMap.get(value.constructor) ?? {}
            if(typeof classSerialize === "function") {
                const id = value[internalID] ?? ids.next().value!
                try {
                    if(typeof value !== "bigint") value[internalID] = id
                } catch {}
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
                const resultObject = {} as any
                const props = getAllPropertyDescriptor(value)
                for(let [key, value] of Object.entries(props)) {
                    Object.defineProperty(resultObject, key, {
                        ...value,
                        enumerable: true,
                    })
                }
                let id = value[internalID] ?? ids.next().value!
                try {
                    value[internalID] = id
                } catch {}
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

export function deserialize(
    str: string, 
    from: "front" | "back" = "front", 
    wse: WSEventHandler,
    cacheMain = cache
) {
    const current = from === "back" ? "front" : "back"
    const {meta, value: valueStr} = JSON.parse(str) as {
        meta: [
            (string | number | symbol)[], 
            {type: string, id?: number, from: "front" | "back"} 
            | {type: "class", id?: number, from: "front" | "back", classID: number}][], 
        value: any
    }
    const value = valueStr == null ? valueStr : JSON.parse(valueStr)
    if(meta.length === 1 && meta[0][0].length === 0) {
        if(meta[0][1].type === "bigint") return BigInt(value)
    }
    return objectMap(value, (value, path, object) => {
        const key: string | number | symbol = path.at(-1)!
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
            const id = keyMeta.id!
            const value = function (...args: any) {
                const callID = callIds.next().value
                wse.emit(`${id}-${from}`, {id: callID, args: serialize(args, current, wse)})
                return new Promise((resolve) => {
                    function onReturn(returned: string) {
                        wse.off(`${id}-${from}`, onReturn)
                        resolve(deserialize(returned, from, wse))
                    }
                    wse.on(`${callID}-${from}`, onReturn)
                })
            }
            try {
                ;(value as any)[internalID] = id
                ;(value as any)[From] = from
            } catch {}
            return [key, value]
        }
        if(keyMeta?.type === "class") {
            const id = keyMeta.id
            const classID = (keyMeta as {classID: number}).classID
            const {deserialize: classDeserialize} = [...globalThis.shareMap][classID][1] ?? {}
            if(typeof classDeserialize === "function") {
                const serializedValue = classDeserialize(value)
                if(typeof serializedValue !== "bigint") {
                    try {
                        serializedValue[internalID] = id
                        serializedValue[From] = keyMeta.from
                    } catch {}
                }
                return [key, serializedValue]
            }
        }
        if(keyMeta?.id != null && value != null && value.from === from) {
            try {
                
                value[internalID] = keyMeta.id
                value[From] = from
            } catch {}
        }
        return [key, value]
    })
}

let wse: Promise<WSEventHandler> | null
if(BROWSER) {
    let url = new URL(window.location.href)
    url.protocol = url.protocol.replace('http', 'ws');
    let ws = new WebSocket(url)
    wse = new Promise(resolve => {

        ws.onopen = function (wss) {
            resolve(WsEvents(ws))
        }
    })
    ws.onerror = function (err) {
    }
    // wse = WsEvents(ws)
}

function callNode(id: string, share: any[], update: (...args: any[]) => any = () => {}) {
    if(wse == null) return
    return new Promise(async (resolve) => {
        const callId = callIds.next().value
        ;(await wse!).emit(id, serialize([callId, ...share, (...args: any[]) => {
            update(...args)
        }], "front", await wse!))
        async function returned(data: string) {
            resolve(deserialize(data, "back", await wse!))
            ;(await wse)?.off(`${id}-${callId}`, returned)
        }
        ;(await wse)!.on(`${id}-${callId}`, returned)
    })
}
export {callNode}

export default async function node<T>(nodeFunction: () => T): Promise<T> {
    return nodeFunction()
}

export {wse}
