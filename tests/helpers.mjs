import { answer } from "../src/answer.mjs";

export function ask(query) {
    return answer(query);
}

export function title(query) {
    const result = answer(query);
    return result && result.title;
}
