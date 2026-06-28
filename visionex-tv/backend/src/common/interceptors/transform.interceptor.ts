import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map }        from "rxjs/operators";

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  meta?:   Record<string, unknown>;
}

/**
 * Wraps every successful response in { success: true, data: ... }
 * so clients have a consistent envelope to unwrap.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the handler returned null/undefined (e.g. 204 No Content), pass through
        if (data === null || data === undefined) return data as any;

        // Unwrap pagination: { data, total, limit, offset } → keep in meta
        if (
          data !== null &&
          typeof data === "object" &&
          "data" in (data as object) &&
          "total" in (data as object)
        ) {
          const d = data as Record<string, unknown>;
          return {
            success: true,
            data:    d.data,
            meta: {
              total:  d.total,
              limit:  d.limit,
              offset: d.offset,
            },
          };
        }

        return { success: true, data };
      })
    );
  }
}
