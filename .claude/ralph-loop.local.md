---
active: true
iteration: 1
max_iterations: 0
completion_promise: "* Completely remove Firebase from the project and migrate fully to Convex
* Perform deep audit of entire codebase to identify all Firebase usage (Firestore, Auth, Storage, listeners, SDK calls, functions, etc.)
* Document all Firebase-related implementations in a detailed markdown file
* Review and understand convex_rules.txt in the root folder before implementation
* Thoroughly study official Convex documentation (schemas, queries, mutations, actions, real-time, auth, storage, function calls, best practices)
* Design a clean Convex backend architecture before coding
* Ensure separation of concerns (screens → services → Convex layer)
* Prevent any direct Convex calls from screens; all calls must go through service files
* Preserve all existing functionality exactly as-is
* Do not change any UI, screen structure, or user flows
* Maintain same business logic behavior regardless of backend change
* Ensure single source of truth where applicable
* Replace Firebase listeners with equivalent Convex real-time patterns
* Refactor backend carefully to avoid breaking existing features
* Use best coding patterns and scalable architecture practices
* Keep core logic of services/screens independent of backend implementation details
* Validate parity between Firebase behavior and Convex behavior before finalizing
* Ask clarifying questions before planning or implementation if anything is unclear
* Ensure migration is thorough, safe, and production-ready without regressions"
started_at: "2026-02-26T11:11:08Z"
---

You have to generate a detailed and well structured plan. This project was created with firebase which is tighly coupled into this app. I want to completely get rid of firebase and use convex instead. Search the web for convex docs, how to implement it, how to define scehmas, how to make queries, mutations, function calls, real-time, and everything. This will be a complete refactor of the backend architecture so be very very thorough and I cannot stress this point enough that you have to very careful and very thorough because all the functionality is currently working with firebase, migrating it to convex should not break anything. You have to use the best strategies, the best coding patterns, ensure separation of concerns, and single source of truth where applicable. There are firebase listeners and other firebase sdk calls that were made directly from the screens or from the service files. You have to deeply search fora all firebase related api calls, listeners, function calls, storage like firestore, anything that is used by firebase and store that detailed information in a markdown file. Once you do that you have to web search for convex docs and understand how to best use convex in this app. There is a file named convex_rules.txt in the root folder of this app so make sure to read that for better undertsanding. I do undertsand that firebase and convex have different implementation and migration might not be as simple, so can you find a way so that the core logic of each service function or the core logic of what each screen is supposed to do remains the same regardless of the backend code? Please be very careful as to NOT change any User Interface or screens. The design is supposed to be the same, the logic of what each screen does and other functionality remains the same, just use convex in place of firebase to do the same stuff and perform the same functionality that firebase was supposed to do regardless of the syntax. Please ensure that convex layer is separate from the screens, convex should never be called from the screens directly instead service files should be used. Always ask any clarifying questions before hand while planning or before implementing.
