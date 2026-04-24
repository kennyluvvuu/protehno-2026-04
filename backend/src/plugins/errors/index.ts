import Elysia, { NotFoundError } from "elysia";

const errorLog = (...args: unknown[]) => console.log("[error]", ...args);

export const errorHandler = new Elysia()
    .onRequest(({ request }) => {
        errorLog(
            "incoming request",
            request.method,
            new URL(request.url).pathname,
        );
    })
    .onError({ as: "global" }, ({ error, status, request }) => {
        const path = new URL(request.url).pathname;

        if (error instanceof NotFoundError) {
            errorLog("not found", {
                method: request.method,
                path,
                message: error.message,
            });
            return status(404, { message: error.message });
        }

        if (error instanceof Error) {
            errorLog("unexpected error", {
                method: request.method,
                path,
                message: error.message,
                name: error.name,
            });
            return status(500, { message: error.message });
        }

    });

export default errorHandler;
