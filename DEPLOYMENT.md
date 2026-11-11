# 上传与部署说明

## 第一阶段：只上传到私有仓库

1. 解压发布 ZIP，打开 `INC-Lens-github` 文件夹。
2. 登录 GitHub，打开 <https://github.com/new>。
3. `Owner` 选自己的账号；`Repository name` 填 `inc-lens`。
4. `Visibility` 选择 **Private**。README、.gitignore、License 的初始化选项都不勾选，本次直接使用文件包中的现有内容。
5. 点击 **Create repository**。创建后确认仓库名称旁有 **Private** 或锁形标识。
6. 空仓库页面点击 **uploading an existing file**；已有文件时可用 **Add file → Upload files**。
7. 把发布文件夹**里面的全部内容**拖入上传区，保留子目录。不要只上传 ZIP，也不要把外层文件夹再套一层。
8. Mac 用户可在访达按 **Command + Shift + .** 显示隐藏项目；一并上传 `.github`、`.gitignore` 和 `.nojekyll`。
9. 提交说明填写 `Initial upload`，提交到 `main`。根据界面点击 **Commit changes**；若先显示 **Propose changes**，按提示创建并合并该上传。
10. 回到 **Code** 页面，确认 `index.html`、`workspace.html`、`README.md` 在根目录，并且 `.github/workflows/pages.yml` 已上传。
11. 打开 **Actions → Check INC Lens / Publish manually** 查看检查。首次运行可能需要点击 **Enable Actions**。`build` 应通过，`deploy` 会跳过。
12. 到这里即完成私有上传。保持 Pages 未启用，不勾选手动发布选项。

本包文件数少于100个，单文件均小于25 MiB，可通过网页分批或整包内容上传。若没有 Actions 记录，先检查隐藏目录是否遗漏。

GitHub 官方说明：[创建仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)、[上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

## 第二阶段：以后需要网页上线时再操作

**仓库私有与网页私有是两套权限。** GitHub Free 的 Pages 通常要求仓库公开；Pro / Team 等计划支持从私有仓库发布，但网页仍可能面向所有人。访问受限的私有 Pages 需要符合 GitHub Enterprise Cloud 的组织条件。

参考：[Pages 支持范围](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)、[网页访问权限](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。

确定可以发布网页及预置案文附件后：

1. 根据所需访问范围与账号方案，决定仓库和网页权限。仅需私有备份时，不必进行这一步，也不必将仓库改成 Public。
2. 在仓库打开 **Settings → Pages → Build and deployment**，`Source` 选择 **GitHub Actions**。
3. 打开 **Actions → Check INC Lens / Publish manually → Run workflow**。
4. 分支选择 `main`，勾选 **发布网页（站点可能公开）**，再点击 **Run workflow**。
5. 等待 `build`、`deploy` 完成。成功后在 **Settings → Pages → Visit site** 打开地址。
6. 以后更新代码仍只检查。需要发布新版时，重复第3至5步。

本工作流通过 GitHub 内置授权发布，不需要手动添加访问令牌或个人密钥。若 Pages 提示需要升级方案，可以继续保留私有仓库，仅进行第一阶段。

## 本地使用

暂时不上线也能使用：在发布文件夹运行 README 中的本地预览命令，然后在浏览器访问本地地址。稿件仍保存在当前浏览器，请通过 Word 导出备份。
