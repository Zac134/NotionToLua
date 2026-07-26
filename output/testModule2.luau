export type TestModule2Entry = {
	targets: { string },
	["数値"]: number,
	["日付"]: string,
}

export type TestModule2 = {
	test: TestModule2Entry,
	test1: TestModule2Entry,
}
local testModule2: TestModule2 = {
	test = {
		targets = { "hoge" },
		["数値"] = 1,
		["日付"] = "2026-07-29",
	},
	test1 = {
		targets = { "foo", "hoge" },
		["数値"] = 100,
		["日付"] = "2026-07-31",
	},
}
return testModule2
