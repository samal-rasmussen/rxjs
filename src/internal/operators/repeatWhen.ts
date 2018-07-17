import { Operation, FOType, Sink, SinkArg } from 'rxjs/internal/types';
import { Observable, sourceAsObservable } from '../Observable';
import { RecyclableSubscription } from 'rxjs/internal/RecyclableSubscription';
import { Subscription } from 'rxjs/internal/Subscription';
import { operator } from 'rxjs/internal/util/operator';
import { subjectSource } from 'rxjs/internal/Subject';
import { tryUserFunction, resultIsError } from 'rxjs/internal/util/userFunction';
import { fromSource } from 'rxjs/internal/create/from';

export function repeatWhen<T>(notifierSetup: (completions: Observable<any>) => Observable<any>): Operation<T, T> {
  return operator((source: Observable<T>, type: FOType, dest: Sink<T>, downstreamSubs: Subscription) => {
    const upstreamSubs = new RecyclableSubscription();
    downstreamSubs.add(upstreamSubs);
    const completions = subjectSource();
    const notifier = tryUserFunction((completions) => fromSource(notifierSetup(completions)), sourceAsObservable(completions));

    if (resultIsError(notifier)) {
      dest(FOType.ERROR, notifier.error, downstreamSubs);
      return;
    }

    let subscribe: () => void;
    subscribe = () => {
      source(FOType.SUBSCRIBE, (t: FOType, v: SinkArg<T>, _: Subscription) => {
        if (t === FOType.COMPLETE) {
          completions(FOType.NEXT, undefined, downstreamSubs);
        } else {
          dest(t, v, downstreamSubs);
        }
      }, upstreamSubs);
    };

    notifier(FOType.SUBSCRIBE, (t: FOType, v: SinkArg<any>, downstreamSubs: Subscription) => {
      if (t === FOType.NEXT) {
        upstreamSubs.recycle();
        subscribe();
      } else  {
        dest(t, v, downstreamSubs);
      }

    }, downstreamSubs);

    subscribe();
  });
}