/**
 * Resolves agent execution order from declared `requires`/`produces`.
 *
 * Kahn's algorithm over the capability graph. Ties break on registry order so a
 * given registry always yields one deterministic sequence — important because the
 * weekly cron and the test suite must agree on what "the pipeline" means.
 */
export function resolveOrder(agents) {
  const producedBy = new Map();
  for (const agent of agents) {
    for (const cap of agent.produces) {
      if (producedBy.has(cap)) {
        throw new Error(
          `Capability "${cap}" is produced by both ${producedBy.get(cap)} and ${agent.name}`,
        );
      }
      producedBy.set(cap, agent.name);
    }
  }

  for (const agent of agents) {
    for (const cap of agent.requires) {
      if (!producedBy.has(cap)) {
        throw new Error(`${agent.name} requires "${cap}", which no agent produces`);
      }
    }
  }

  const remaining = [...agents];
  const satisfied = new Set();
  const ordered = [];

  while (remaining.length) {
    const idx = remaining.findIndex((a) => a.requires.every((c) => satisfied.has(c)));
    if (idx === -1) {
      const stuck = remaining.map((a) => a.name).join(', ');
      throw new Error(`Cycle in agent graph, cannot order: ${stuck}`);
    }
    const [next] = remaining.splice(idx, 1);
    next.produces.forEach((c) => satisfied.add(c));
    ordered.push(next);
  }

  return ordered;
}

/**
 * Runs the pipeline. Each agent receives the shared context plus everything
 * produced so far, and returns the capabilities it declared.
 *
 * An agent that throws halts the run — a half-executed pipeline that still
 * publishes is worse than one that stops and reports.
 */
export async function runPipeline(agents, context) {
  const ordered = resolveOrder(agents);
  const bag = {};
  const trace = [];

  for (const agent of ordered) {
    const started = Date.now();
    try {
      const output = (await agent.run({ ...context, ...bag })) ?? {};
      for (const cap of agent.produces) {
        if (!(cap in output)) {
          throw new Error(`${agent.name} declared "${cap}" but did not return it`);
        }
        bag[cap] = output[cap];
      }
      trace.push({ agent: agent.name, ok: true, ms: Date.now() - started });
    } catch (err) {
      trace.push({ agent: agent.name, ok: false, ms: Date.now() - started, error: err.message });
      const wrapped = new Error(`${agent.name} failed: ${err.message}`);
      wrapped.trace = trace;
      wrapped.cause = err;
      throw wrapped;
    }
  }

  return { ...bag, trace };
}
