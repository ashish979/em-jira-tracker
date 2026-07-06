import { refreshHandler } from "./handlers/refresh.mjs";

const section = process.argv[2] || "overview";
const response = await refreshHandler({
  section,
  body: {
    settings: {
      teamMembers: "aisha@example.com\ndev@example.com",
      trackedItems: "board:42 Platform execution\nfilter:181 Release blockers",
    },
  },
});

console.log(response.body);
