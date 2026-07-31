### Summary

This PR fixes getThreadList to accept both array and single-object GraphQL batch responses returned by Facebook or the updated FCA defaultFuncs.post. The previous code assumed the response was always an array which caused "getThreadList: Invalid response from server" even when Facebook returned valid GraphQL data.

### Changes
- src/apis/getThreadList.js: normalize GraphQL batch response to an array (if necessary), locate the batch payload entry, and extract message_threads.nodes from either payload.o0.data or payload.data.

### Root cause
The upgraded FCA or defaultFuncs.post may return the GraphQL batch result as a single object instead of an array. The old code only accepted arrays and therefore threw an error prematurely.

### Verification
1. Run the bot and login with Facebook credentials that previously failed.
2. Ensure the bot logs in and getThreadList returns an array of threads instead of throwing.

### Risk
Low — only response-shape normalization; original validations and error conditions preserved.
