// Candidate v2 acceptance. Historical oracles and scores remain unchanged.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { runSupervisorTick } = await import(pathToFileURL(resolve(process.argv[2], "packages/controller/controller.mjs")));
const ROOT = {
  target: "bb029-root",
  target_kind: "name",
  agent_kind: "pi",
  pane_id: "w-root:p1",
  workspace_id: "w-root",
};

const CHILD = {
  lane_id: "lane-child",
  target: "bb029-writer",
  target_kind: "name",
  pane_id: "w-child:p1",
  workspace_id: "w-child",
};


async function createFixture({
  root = ROOT,
  child = CHILD,
  piGoalPauseDetection = true,
  parentGoal,
  settledRoot = true,
  workflowStatus,
  workflowOutcome,
  laneStatus,
  completionReceipt,
  approvalRequests,
  questionRequests,
  messageRequests,
  siblingLane,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "herdr-controller-"));
  const stateDir = join(directory, "state");
  const manifestPath = join(
    directory,
    "workflow",
    ".pi",
    "herdr-orchestrator",
    "manifest.json",
  );
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 });
  const manifest = {
    version: 2,
    ...(parentGoal
      ? {
          parentGoal: {
            ...parentGoal,
            ...(parentGoal.supervisor
              ? {
                  supervisor: {
                    ...parentGoal.supervisor,
                    ...(settledRoot
                      ? {
                          rootTurn: {
                            state: "idle",
                            runId: "settled-fixture-run",
                            paneId: root.pane_id,
                            workspaceId: root.workspace_id,
                            updatedAt: "2026-09-14T00:00:00.000Z",
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    workflows: [
      {
        id: "herdr-bb029",
        ...(workflowStatus ? { status: workflowStatus } : {}),
        ...(workflowOutcome ? { outcome: workflowOutcome } : {}),
        ...(approvalRequests ? { approvalRequests } : {}),
        ...(questionRequests ? { questionRequests } : {}),
        ...(messageRequests ? { messageRequests } : {}),
        ownership: {
          createdBy: "herdr-orchestrator",
          workspaceId: child.workspace_id,
        },
        lanes: [
          {
            id: child.lane_id,
            paneId: child.pane_id,
            agentName: child.target,
            ...(laneStatus ? { status: laneStatus } : {}),
            ...(completionReceipt ? { completionReceipt } : {}),
          },
          ...(siblingLane
            ? [
                {
                  id: siblingLane.lane_id,
                  paneId: siblingLane.pane_id,
                  agentName: siblingLane.target,
                },
              ]
            : []),
        ],
      },
    ],
  };
  const config = {
    version: 1,
    owner: "herdr-orchestrator",
    root,
    workflows: [
      {
        workflow_id: "herdr-bb029",
        manifest_path: manifestPath,
        pi_goal_pause_detection: piGoalPauseDetection,
        lanes: [child, ...(siblingLane ? [siblingLane] : [])],
      },
    ],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await writeFile(
    join(stateDir, "config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    { mode: 0o600 },
  );
  return {
    directory,
    stateDir,
    manifestPath,
    async manifest() {
      return JSON.parse(await readFile(manifestPath, "utf8"));
    },
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}


function rootAgentInfo() {
  return {
    result: {
      type: "agent_info",
      agent: {
        agent: ROOT.agent_kind,
        name: ROOT.target,
        pane_id: ROOT.pane_id,
        workspace_id: ROOT.workspace_id,
        agent_status: "idle",
      },
    },
  };
}


async function receiptFixture(delivery = "pending", parentGoal) {
  const fixture = await createFixture({ parentGoal, workflowStatus: "completed", workflowOutcome: "completed",
    completionReceipt: { id: "incarnation-receipt", summary: "Verified output in lane", delivery } });
  const manifest = await fixture.manifest();
  manifest.workflows[0].taskBinding = { rootPaneId: ROOT.pane_id, workspaceId: ROOT.workspace_id, rootSessionPath: "/sessions/owning-root.jsonl" };
  manifest.workflows[0].lanes[0].incarnationId = "incarnation-receipt";
  await writeFile(fixture.manifestPath, JSON.stringify(manifest));
  return fixture;
}

const id = '01a0b04d-0bef-7207-b486-d51d62f0e3dc';
const other = '01a0b04d-0bef-7207-b486-d51d62f0e3dd';
const checks = [];
for (const c of [
 {id:'fifo-session-binding-rejected',kind:'id',fifo:true,pass:false},
 {id:'mistagged-path-id-rejected',kind:'id',pathAsId:true,pass:false},
 {id:'canonical-native-path-alias',kind:'path',alias:true,pass:true},
 {id:'foreign-native-path-alias-rejected',kind:'path',alias:true,foreignAlias:true,pass:false},
 {id:'exact-native-path-without-file',kind:'path',missing:true,pass:true},
 {id:'malformed-id-rejected',kind:'id',value:'not-a-uuid',legacyBinding:'not-a-uuid',pass:false},
 {id:'foreign-legacy-id-rejected',kind:'id',legacy:true,value:other,pass:false},
 {id:'unknown-legacy-kind-rejected',kind:'unknown',legacy:true,pass:false},
 {id:'uppercase-legacy-id-binding',kind:'id',legacyBinding:id.toUpperCase(),value:id.toUpperCase(),pass:true},
 {id:'oversized-header-rejected',kind:'id',content:' '.repeat(65536)+JSON.stringify({type:'session',id})+'\n',pass:false},
 {id:'header-id-mismatch-rejected',kind:'id',content:JSON.stringify({type:'session',id:other})+'\n',pass:false},
 {id:'legacy-busy-then-ready-recovers-once',kind:'id',legacy:true,recover:true,pass:true},
 {id:'native-id-matches-bound-header',kind:'id',pass:true},
 {id:'native-path-matches',kind:'path',pass:true},
 {id:'foreign-id-rejected',kind:'id',value:other,pass:false},
 {id:'foreign-path-rejected',kind:'path',value:'/foreign/session.jsonl',pass:false},
 {id:'missing-header-rejected',kind:'id',missing:true,pass:false},
 {id:'malformed-header-rejected',kind:'id',content:'{\n',pass:false},
 {id:'message-header-rejected',kind:'id',content:JSON.stringify({type:'message',id})+'\n',pass:false},
 {id:'unterminated-header-rejected',kind:'id',content:JSON.stringify({type:'session',id}),pass:false},
 {id:'unknown-kind-rejected',kind:'unknown',pass:false},
 {id:'busy-id-root-rejected',kind:'id',status:'working',pass:false},
 {id:'noninteractive-id-root-rejected',kind:'id',interactive:false,pass:false},
 {id:'launching-id-root-rejected',kind:'id',launch:true,pass:false},
 {id:'wrong-pane-rejected',kind:'id',pane:'other:p1',pass:false},
 {id:'stale-incarnation-rejected',kind:'id',stale:true,pass:false},
 ...['sending','uncertain','delivered'].map(delivery=>({id:delivery+'-not-replayed',kind:'id',delivery,pass:false})),
 {id:'id-busy-then-ready-recovers-once',kind:'id',recover:true,pass:true},
 {id:'legacy-id-binding',kind:'id',legacy:true,pass:true},
 {id:'non-pi-id-binding',kind:'id',legacy:true,harness:'codex',pass:true},
 {id:'non-pi-does-not-read-pi-header',kind:'id',harness:'codex',pass:false},
]) {
 const fixture=await receiptFixture(c.delivery || 'pending');
 try {
  const sessionPath=join(fixture.directory,'opaque-name.jsonl');
  if(c.fifo) {
   const result=spawnSync('mkfifo',[sessionPath],{encoding:'utf8',timeout:1000});
   assert.ifError(result.error);
   assert.equal(result.status,0,result.stderr);
  }
  if(!c.missing && !c.fifo) await writeFile(sessionPath,c.content??JSON.stringify({type:'session',version:3,id,cwd:fixture.directory})+'\n');
  const aliasPath=join(fixture.directory,'alias.jsonl');
  if(c.alias) {
   const target=c.foreignAlias?join(fixture.directory,'foreign.jsonl'):sessionPath;
   if(c.foreignAlias) await writeFile(target,JSON.stringify({type:'session',id:other})+'\n');
   await symlink(target,aliasPath);
  }
  const before=await fixture.manifest();
  before.workflows[0].taskBinding.rootSessionPath=c.legacyBinding??(c.legacy?id:sessionPath);
  if(c.stale) before.workflows[0].lanes[0].completionReceipt.id='stale';
  if(c.harness) {
   const config=JSON.parse(await readFile(join(fixture.stateDir,'config.json'),'utf8'));
   config.root.agent_kind=c.harness;
   await writeFile(join(fixture.stateDir,'config.json'),JSON.stringify(config));
  }
  await writeFile(fixture.manifestPath,JSON.stringify(before));
  let prompts=0,status=c.recover?'working':(c.status??'idle');
  const api={async request(method){
   if(method==='pane.report_metadata') return {};
   if(method==='agent.get') {const info=rootAgentInfo().result; Object.assign(info.agent,{agent:c.harness??'pi',pane_id:c.pane??ROOT.pane_id,agent_status:status,interactive_ready:c.interactive??true,launch_pending:c.launch??false,agent_session:{kind:c.kind,value:c.pathAsId?sessionPath:c.alias?aliasPath:c.value??(c.kind==='path'?sessionPath:id)}});return info;}
   if(method==='agent.prompt') {assert.equal((await fixture.manifest()).workflows[0].lanes[0].completionReceipt.delivery,'sending');prompts++;return {};}
   throw Error('unexpected method '+method);
  }};
  const tick=()=>runSupervisorTick({stateDir:fixture.stateDir,herdr:api});
  if(c.recover){await tick();assert.equal(prompts,0);status='idle';}
  await Promise.all([tick(),tick()]);
  await tick();
  assert.equal(prompts,c.pass?1:0,'prompt count');
  const after=await fixture.manifest();
  const expected=structuredClone(before);
  if(c.pass) expected.workflows[0].lanes[0].completionReceipt.delivery='delivered';
  assert.deepEqual(after,expected,'only receipt delivery may change');
  checks.push({id:c.id,pass:true});
 }catch(error){checks.push({id:c.id,pass:false,error:error.message});}
 finally{await fixture.cleanup();}
}
console.log(JSON.stringify({pass:checks.every(x=>x.pass),checks},null,2));
process.exitCode=checks.every(x=>x.pass)?0:1;
