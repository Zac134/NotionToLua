export type TestModuleEntry = {
    date: string,
    price: number,
    targets: { string },
}

export type TestModule = {
    test: TestModuleEntry,
    test1: TestModuleEntry,
}
local testModule: TestModule = {
    test = {
            date = "2026-07-29",
            price = 1,
            targets = { "hoge" },
        },
    test1 = {
            date = "2026-07-31",
            price = 100,
            targets = { "foo", "hoge" },
        },
}
return testModule
