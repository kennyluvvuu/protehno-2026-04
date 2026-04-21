import Elysia, { NotFoundError } from "elysia";

export const errorHandler = new Elysia().onError(
    { as: "global" },
    ({ error, status }) => {
        if (error instanceof NotFoundError) {
            return status(404, { message: error.message });
        }
    },
);

export default errorHandler;
