import { Logger } from './logger.js';
import { Server } from './server.js';
import { Stdio } from './stdio.js';
import { generateMockActionPlan, getActionPlanPrompt } from './prompts/actionPlanner.js';
import { generateMockSchedule } from './prompts/scheduleGenerator.js';

async function main() {
    // サーバーを起動
    startServer();
}

/**
 * 現在の日時を様々な形式で取得する
 * @returns 様々な形式の現在の日時情報
 */
function getCurrentDateTime() {
  const now = new Date();
  
  // 日付のフォーマット (YYYY-MM-DD)
  const dateFormat = now.toISOString().split('T')[0];
  
  // 時刻のフォーマット (HH:MM)
  const timeFormat = now.toTimeString().substring(0, 5);
  
  // 曜日の取得 (日本語)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[now.getDay()];
  
  // 日本語の日付形式
  const jpDateFormat = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${weekday})`;
  
  // タイムスタンプ (Unix time)
  const timestamp = Math.floor(now.getTime() / 1000);
  
  return {
    iso: now.toISOString(),
    date: dateFormat,
    time: timeFormat,
    dateTime: `${dateFormat} ${timeFormat}`,
    jpDate: jpDateFormat,
    timestamp: timestamp,
    weekday: weekday
  };
}

/**
 * MCPサーバーを起動
 */
function startServer() {
  // Transportインスタンスを作成
  const transport = new Stdio();
  
  // Serverインスタンスを作成
  const server = new Server(
    { name: 'MCP Server', version: '0.0.1' },
    { 
      instructions: 'This is a simple implementation of an MCP server using stdio transport.',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: true
        },
      },
    },
    transport
  );

  // ツールの登録
  server.registerTool({ // <-- 追加
    name: 'count',
    description: '文字数をカウントするツール',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '文字数をカウントしたいテキスト'
        }
      },
      required: ['text']
    },
    execute: async (args: { text: string }) => {
      return { content: [{ type: "text", text: args.text.length.toString() }] };
    }
  });



  // アイディアプランナーツール（プロンプト生成）を登録
  server.registerTool({
    name: 'idea_planner',
    description: 'ユーザーのアイディアからアクションプランを生成するためのプロンプトを生成するツール',
    inputSchema: {
      type: 'object',
      properties: {
        idea: {
          type: 'string',
          description: 'ユーザーのアイディア'
        },
        context: {
          type: 'string',
          description: 'コンテキスト情報（オプション）'
        }
      },
      required: ['idea']
    },
    execute: async (args: { idea: string, context?: string }) => {
      // 現在の日時情報を取得
      const dateTimeInfo = getCurrentDateTime();
      
      Logger.info("日時情報: " + JSON.stringify(dateTimeInfo));
      
      // プロンプトテンプレートを取得
      const prompt = getActionPlanPrompt(args.idea, args.context || "", dateTimeInfo);
      
      // 実行時間の日本語表示
      const timeDisplay = `${dateTimeInfo.jpDate} ${dateTimeInfo.time} (${dateTimeInfo.weekday}曜日)`;
      
      return {
        content: [
          { 
            type: "text", 
            text: "## 以下のプロンプトを実行してください\n\n```\n" + prompt + "\n```\n\n" +
                 "## 使用した日時情報\n\n" + timeDisplay
          }
        ]
      };
    }
  });

  // スケジュール生成ツールを登録（シンプル化バージョン）
  server.registerTool({
    name: 'schedule_generator',
    description: 'アクションプランをGoogleカレンダーにインポート可能なiCalendar形式に変換するツール',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'イベントのタイトル'
        },
        date: {
          type: 'string',
          description: 'イベントの日付（YYYY-MM-DD形式）'
        },
        description: {
          type: 'string',
          description: 'イベントの説明（オプション）'
        }
      },
      required: ['title', 'date']
    },
    execute: async (args: { title: string, date: string, description?: string }) => {
      // iCalendar形式に変換
      const icalContent = generateMockSchedule(args.title, args.date, args.description);
      
      return {
        content: [
          { type: "text", text: "## Googleカレンダー登録用iCalendarデータ\n\n```\n" + icalContent + "\n```" },
          { 
            type: "text", 
            text: "\n\n## 使い方\n\n1. 上記のテキストをコピーして、.icsファイルとして保存\n2. Googleカレンダーで「その他のカレンダー」の+ボタン→「インポート」を選択\n3. 作成した.icsファイルをアップロード" 
          }
        ]
      };
    }
  });

  // サーバーの起動
  server.start();
  Logger.info('MCP Server started');
}

main();
