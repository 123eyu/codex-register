import {appConfig} from "./config.js";
import {generateRandomUserAgent} from "./constants.js";
import {OpenAIClient} from "./openai.js";

function readArgValue(flag: string): string {
    const index = process.argv.indexOf(flag);
    if (index === -1) {
        return "";
    }
    return process.argv[index + 1] ?? "";
}

function hasFlag(flag: string): boolean {
    return process.argv.includes(flag);
}

function readNumberArg(flag: string): number | null {
    const raw = readArgValue(flag).trim();
    if (!raw) {
        return null;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}

async function runOnce(): Promise<void> {
    const email = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
    const client = new OpenAIClient({
        email: email || undefined,
        password: appConfig.defaultPassword,
        userAgent: generateRandomUserAgent(),
        manualMode: manualOtp,
    });
    await client.authRegisterHTTP();

    const result = await client.authLoginHTTP();
    console.log(
        `[✅️授权成功] 邮箱：${client.email} 密码：${appConfig.defaultPassword} 授权文件：${result.authFile ?? ""}`,
    );
}

async function main() {
    let round = 0;
    let successCount = 0;
    let failCount = 0;
    const manualEmail = readArgValue("--email").trim();
    const authOnly = hasFlag("--auth");
    const manualOtp = hasFlag("--otp");
    const maxRounds = readNumberArg("--n");

    if (authOnly) {
        if (!manualEmail) {
            throw new Error("使用 --auth 时必须同时指定 --email");
        }
        try {
            const client = new OpenAIClient({
                email: manualEmail,
                password: appConfig.defaultPassword,
                userAgent: generateRandomUserAgent(),
                manualMode: manualOtp,
            });
            const result = await client.authLoginHTTP();
            console.log(
                `[✅️授权成功] 邮箱：${client.email} 密码：${appConfig.defaultPassword} 授权文件：${result.authFile ?? ""}`,
            );
        } catch (error) {
            console.error(`[❌️授权失败]`, error);
        }
        return;
    }

    if (manualEmail) {
        try {
            await runOnce();
        } catch (error) {
            console.error(`[❌️授权失败]`, error);
        }
        return;
    }

    while (!maxRounds || round < maxRounds) {
        round += 1;
        console.log(
            `第 ${round} 轮开始: 成功=${successCount} 失败=${failCount} 模式=自动`,
        );
        let roundFailed = false;
        try {
            await runOnce();
            successCount += 1;
        } catch (error) {
            roundFailed = true;
            failCount += 1;
            console.error(`[❌️授权失败]`, error);
        }

        if (appConfig.loopDelayMs > 0) {
            console.log(`[延迟] 轮次间等待 ${appConfig.loopDelayMs}ms`);
            await new Promise((resolve) => setTimeout(resolve, appConfig.loopDelayMs));
        }
    }

    console.log(
        `自动模式结束: 已执行=${round} 成功=${successCount} 失败=${failCount}`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
