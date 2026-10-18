import numpy as np

import personal_clock_intents as clock
import personal_clock_strategy as clock_context
import personal_tray_intents as tray


class JointState:
    def __init__(self, actor, model, initial_new=True):
        self.actor = actor
        self.models = {'clock': model['clockIntents'], 'tray': model['trayIntents']}
        self.posterior = {phase: np.asarray(model['priors'][0 if initial_new else 1]) for phase, model in self.models.items()}
        self.previous = {'clock': None, 'tray': None}
        self.started = {'clock': False, 'tray': False}

    def evaluate(self, decision):
        phase = 'clock' if decision['kindContext'][11] > 0 else 'tray'
        module = clock if phase == 'clock' else tray
        context_module = clock_context if phase == 'clock' else tray
        model = self.models[phase]
        active = model['trainingClockChoices' if phase == 'clock' else 'trainingChoices'] > 0 and bool(np.any(
            decision['knownPlan' if phase == 'clock' else 'trayPlan']))
        prior = self.posterior[phase]
        if active and self.started[phase]:
            context = context_module.context_of(decision, self.previous[phase])
            prior = self.posterior[phase] @ clock.transitions_of(context[None, :], model['switchWeights'])[0]
        values, components = module.predictive(decision, self.actor, model, prior)
        return {'phase': phase, 'active': active, 'prior': prior, 'values': values, 'components': components}

    def observe(self, decision, selected, evaluated=None):
        evaluated = evaluated or self.evaluate(decision)
        if not evaluated['active']:
            return
        phase = evaluated['phase']
        context_module = clock_context if phase == 'clock' else tray
        posterior = evaluated['prior'] * evaluated['components'][selected]
        self.posterior[phase] = posterior / posterior.sum()
        self.previous[phase] = context_module.observation_of(decision, selected)
        self.started[phase] = True
