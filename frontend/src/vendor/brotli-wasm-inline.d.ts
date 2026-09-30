/** 内联 wasm 的 base64 分段（join 后为完整二进制） */
export declare const WASM_BASE64: string
/** wasm-bindgen glue 的 init()：传 Uint8Array 时直接从字节实例化（不 fetch） */
export declare function brotliInit(module_or_path?: Uint8Array): Promise<unknown>
/** 高层压缩（必须先 brotliInit） */
export declare function compress(buf: Uint8Array, options?: { quality?: number }): Uint8Array
/** 高层解压（必须先 brotliInit） */
export declare function decompress(buf: Uint8Array): Uint8Array
