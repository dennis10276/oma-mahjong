from personal_known_plan import fit_plan, plan_probabilities, score_plan


FEATURES = ['knownClockRoute', 'foundExitRoom', 'knownClockTrap', 'clockInformation', 'clockBoundary']
PARAMETERS = {'taps': 12, 'nodes': 256}


def fit_route(games, actor, penalty=20):
    model = fit_plan(games, actor, penalty)
    model.update(type='personalClockRoutes-v1', features=FEATURES, parameters=PARAMETERS)
    model['settings']['clockBoundaryWeight'] = model['settings'].pop('planningBoundaryWeight')
    model['note'] = ('Own earlier observed clock choices only, using the same conditional-softmax optimizer and frozen ownAll memberships. '
                     'No family prior, target trajectory or winning-count labels. Clock route support, exit room, traps and information '
                     'receive independent bounded personal weights; none is a forced greedy preference. '
                     'The bounded-uncertainty coefficient is fixed at zero. No-clock actions have zero residual features. '
                     'Autonomous evaluation must disable the generic physicalPlan controller so it cannot bypass this fitted policy.')
    return model


__all__ = ['FEATURES', 'PARAMETERS', 'fit_route', 'plan_probabilities', 'score_plan']
