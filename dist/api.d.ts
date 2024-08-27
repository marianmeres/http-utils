interface BaseParams {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    path: string;
}
interface FetchParams {
    data?: any;
    token?: string | null;
    headers?: null | Record<string, string>;
    signal?: any;
    credentials?: null | 'omit' | 'same-origin' | 'include';
    raw?: null | boolean;
    assert?: null | boolean;
}
type BaseFetchParams = BaseParams & FetchParams;
type ErrorMessageExtractor = (body: any, response: Response) => any;
export declare function createHttpApi(base?: string | null, defaults?: Partial<BaseFetchParams> | (() => Promise<Partial<BaseFetchParams>>), factoryErrorMessageExtractor?: ErrorMessageExtractor | null | undefined): {
    get(path: string, params?: FetchParams, respHeaders?: any, errorMessageExtractor?: ErrorMessageExtractor | null | undefined, _dumpParams?: boolean): Promise<any>;
    post(path: string, data?: any, params?: FetchParams, respHeaders?: any, errorMessageExtractor?: ErrorMessageExtractor | null | undefined, _dumpParams?: boolean): Promise<any>;
    put(path: string, data?: any, params?: FetchParams, respHeaders?: any, errorMessageExtractor?: ErrorMessageExtractor | null | undefined, _dumpParams?: boolean): Promise<any>;
    patch(path: string, data?: any, params?: FetchParams, respHeaders?: any, errorMessageExtractor?: ErrorMessageExtractor | null | undefined, _dumpParams?: boolean): Promise<any>;
    del(path: string, data?: any, params?: FetchParams, respHeaders?: any, errorMessageExtractor?: ErrorMessageExtractor | null | undefined, _dumpParams?: boolean): Promise<any>;
};
export declare namespace createHttpApi {
    var defaultErrorMessageExtractor: ErrorMessageExtractor | null | undefined;
}
export {};
