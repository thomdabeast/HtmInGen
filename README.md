# HtmInGen
A MVC Framework for Chrome Extensions written in TypeScript. Nothing special. If you want to contribute just fork and send a PR.

Currently not in NPM yet.

## How It Works

Currently, it looks in the `views` folder of where HtmInGen.ts is placed. Both the controller name and view file must have the same. For example: `class MyController ...` and `MyController.htm`.

Within the `views` folder you need to have your view file(which is a `.htm` file) and the corresponding controller(a `.ts` file)

**For example:**
```
src/
  HtmInGen.ts
  views/
    MyView.htm
    MyView.ts
```

The view file is just basic HTML but with a few extra pieces of magic.

**Inserting Data**
To insert data from the controller, you need to have the replacement string `#{...}`.

**For example:**
If your controller has a field `foo` you would insert it into your view like so `#{foo}`.
**MyControllerView.ts**
```
class MyController extends BaseView {
  foo: string;
}
```
**MyControllerView.htm**
```
<div>#{foo}</div>
```

## Pub Sub Events
