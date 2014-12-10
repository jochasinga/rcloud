(function() {

function ensure_image_has_hash(img)
{
    if (img.dataset.sha256)
        return img.dataset.sha256;
    var hasher = new sha256(img.getAttribute("src"), "TEXT");
    img.dataset.sha256 = hasher.getHash("SHA-256", "HEX");
    return img.dataset.sha256;
}

function create_cell_html_view(language, cell_model) {
    var ace_widget_;
    var ace_session_;
    var ace_document_;
    var am_read_only_ = "unknown";
    var source_div_;
    var code_div_;
    var result_div_;
    var change_content_;
    var edit_mode_; // note: neither true nor false

    var EXTRA_HEIGHT = 2;
    var notebook_cell_div  = $("<div class='notebook-cell'></div>");
    update_div_id();
    notebook_cell_div.data('rcloud.model', cell_model);

    //////////////////////////////////////////////////////////////////////////
    // button bar

    var insert_cell_button = ui_utils.fa_button("icon-plus-sign", "insert cell");
    var join_button = ui_utils.fa_button("icon-link", "join cells");
    var edit_button = ui_utils.fa_button("icon-edit", "toggle edit");
    var split_button = ui_utils.fa_button("icon-unlink", "split cell");
    var remove_button = ui_utils.fa_button("icon-trash", "remove");
    var run_md_button = ui_utils.fa_button("icon-play", "run");
    var gap = $('<div/>').html('&nbsp;').css({'line-height': '25%'});

    function update_model() {
        if(!ace_session_)
            return null;
        return cell_model.content(ace_session_.getValue());
    }
    function update_div_id() {
        notebook_cell_div.attr('id', Notebook.part_name(cell_model.id(), cell_model.language()));
    }
    function set_widget_height() {
        source_div_.css('height', (ui_utils.ace_editor_height(ace_widget_, 3) + EXTRA_HEIGHT) + "px");
    }
    var enable = ui_utils.enable_fa_button;
    var disable = ui_utils.disable_fa_button;

    var has_result = false;

    insert_cell_button.click(function(e) {
        if (!$(e.currentTarget).hasClass("button-disabled")) {
            shell.insert_cell_before(cell_model.language(), cell_model.id());
        }
    });
    join_button.click(function(e) {
        join_button.tooltip('destroy');
        if (!$(e.currentTarget).hasClass("button-disabled")) {
            shell.join_prior_cell(cell_model);
        }
    });
    split_button.click(function(e) {
        if (!$(e.currentTarget).hasClass("button-disabled")) {
            var range = ace_widget_.getSelection().getRange();
            var point1, point2;
            point1 = ui_utils.character_offset_of_pos(ace_widget_, range.start);
            if(!range.isEmpty())
                point2 = ui_utils.character_offset_of_pos(ace_widget_, range.end);
            shell.split_cell(cell_model, point1, point2);
        }
    });
    edit_button.click(function(e) {
        if (!$(e.currentTarget).hasClass("button-disabled")) {
            result.edit_source(!edit_mode_);
        }
    });
    remove_button.click(function(e) {
        if (!$(e.currentTarget).hasClass("button-disabled")) {
            cell_model.parent_model.controller.remove_cell(cell_model);

            // twitter bootstrap gets confused about its tooltips if parent element
            // is deleted while tooltip is active; let's help it
            $(".tooltip").remove();
        }
    });
    function execute_cell() {
        result_div_.html("Computing...");
        result.edit_source(false);

        RCloud.UI.with_progress(function() {
            return cell_model.controller.execute();
        });
    }
    run_md_button.click(function(e) {
        execute_cell();
    });
    var cell_status = $("<div class='cell-status'></div>");
    var button_float = $("<div class='cell-controls'></div>");
    cell_status.append(button_float);
    cell_status.append($("<div style='clear:both;'></div>"));
    var col = $('<table/>').append('<tr/>');
    var select_lang = $("<select class='form-control'></select>");
    var lang_selectors = {};
    function add_language_selector(lang) {
        var element = $("<option></option>").text(lang);
        lang_selectors[lang] = element;
        select_lang.append(element);
    }
    _.each(RCloud.language.available_languages(), add_language_selector);
    if(!lang_selectors[language]) // unknown language: add it
        add_language_selector(language);

    select_lang.change(function() {
        var language = select_lang.val();
        cell_model.parent_model.controller.change_cell_language(cell_model, language);
        result.clear_result();
    });

    function set_background_color(language) {
        var bg_color = language === 'Markdown' ? "#F7EEE4" : "#E8F1FA";
        ace_div.css({ 'background-color': bg_color });
    }

    function update_language() {
        language = cell_model.language();
        if(!lang_selectors[language])
            throw new Error("tried to set language to unknown language " + language);
        select_lang.val(language);
        if(ace_widget_) {
            set_background_color(language);
            var LangMode = ace.require(RCloud.language.ace_mode(language)).Mode;
            ace_session_.setMode(new LangMode(false, ace_document_, ace_session_));
        }
    }

    col.append($("<div></div>").append(select_lang));
    $.each([run_md_button, edit_button, gap, split_button, remove_button],
           function() {
               col.append($('<td/>').append($(this)));
           });

    button_float.append(col);
    notebook_cell_div.append(cell_status);

    var insert_button_float = $("<div class='cell-insert-control'></div>");
    insert_button_float.append(join_button);
    insert_button_float.append(insert_cell_button);
    notebook_cell_div.append(insert_button_float);

    //////////////////////////////////////////////////////////////////////////

    var inner_div = $("<div></div>");
    var clear_div = $("<div style='clear:both;'></div>");
    notebook_cell_div.append(inner_div);
    notebook_cell_div.append(clear_div);

    source_div_ = $('<div class="source-div"></div>');
    code_div_ = $('<div class="code-div"></div>');
    source_div_.append(code_div_);

    var outer_ace_div = $('<div class="outer-ace-div"></div>');
    var ace_div = $('<div style="width:100%; height:100%;"></div>');
    set_background_color(language);

    source_div_.append(outer_ace_div);
    inner_div.append(source_div_);
    outer_ace_div.append(ace_div);

    // click on code to edit
    if(!shell.is_view_mode()) {
        // distinguish between a click and a drag
        // http://stackoverflow.com/questions/4127118/can-you-detect-dragging-in-jquery
        code_div_.on('mousedown', function(e) {
            $(this).data('p0', { x: e.pageX, y: e.pageY });
        }).on('mouseup', function(e) {
            var p0 = $(this).data('p0');
            if(p0) {
                var p1 = { x: e.pageX, y: e.pageY },
                    d = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
                if (d < 4) {
                    result.edit_source(true);
                }
            }
        });
    }

    function clear_result() {
        has_result = false;
        result_div_.html('<pre><code> (no result) </code></pre>');
    }

    function create_edit_widget() {
        if(ace_widget_) return;

        ace.require("ace/ext/language_tools");
        ace_widget_ = ace.edit(ace_div[0]);
        ace_session_ = ace_widget_.getSession();
        ace_widget_.setValue(cell_model.content());
        ui_utils.ace_set_pos(ace_widget_, 0, 0); // setValue selects all
        // erase undo state so that undo doesn't erase all
        ui_utils.on_next_tick(function() {
            ace_session_.getUndoManager().reset();
        });
        ace_document_ = ace_session_.getDocument();
        ace_widget_.setOptions({
            enableBasicAutocompletion: true
        });
        ace_session_.on('change', function() {
            set_widget_height();
            ace_widget_.resize();
        });

        ace_widget_.setTheme("ace/theme/chrome");
        ace_session_.setUseWrapMode(true);
        ace_widget_.resize();

        ui_utils.add_ace_grab_affordance(ace_widget_.container);

        ui_utils.install_common_ace_key_bindings(ace_widget_, function() {
            return language;
        });
        ace_widget_.commands.addCommands([{
            name: 'executeCell',
            bindKey: {
                win: 'Alt-Return',
                mac: 'Alt-Return',
                sender: 'editor'
            },
            exec: function(ace_widget_, args, request) {
                execute_cell();
            }
        }]);
        change_content_ = ui_utils.ignore_programmatic_changes(ace_widget_, function() {
            cell_model.parent_model.on_dirty();
        });
        update_language();
    }
    function find_code_elems(parent) {
        return parent
            .find("pre code")
            .filter(function(i, e) {
                // things which have defined classes coming from knitr and markdown
                return e.classList.length > 0;
            });
    }
    function highlight_code() {
        // highlight R
        find_code_elems(code_div_).each(function(i, e) {
            hljs.highlightBlock(e);
        });
    }
    function assign_code() {
        var code = cell_model.content();
        find_code_elems(code_div_).remove();
        var elem = $('<code></code>').append(code);
        var hljs_class = RCloud.language.hljs_class(cell_model.language());
        if(hljs_class)
            elem.addClass(hljs_class);
        code_div_.append($('<pre></pre>').append(elem));
        highlight_code();
    }
    assign_code();

    result_div_ = $('<div class="r-result-div"></div>');
    clear_result();
    inner_div.append(result_div_);
    update_language();

    var result = {

        //////////////////////////////////////////////////////////////////////
        // pubsub event handlers

        content_updated: function() {
            assign_code();
            if(ace_widget_) {
                var range = ace_widget_.getSelection().getRange();
                var changed = change_content_(cell_model.content());
                ace_widget_.getSelection().setSelectionRange(range);
            }
            return changed;
        },
        self_removed: function() {
            notebook_cell_div.remove();
        },
        id_updated: update_div_id,
        language_updated: update_language,
        result_updated: function(r) {
            has_result = true;
            result_div_.html(r);

            // There's a list of things that we need to do to the output:
            var uuid = rcloud.deferred_knitr_uuid;


            // temporary (until we get rid of knitr): delete code from results
            find_code_elems(result_div_).parent().remove();

            // we use the cached version of DPR instead of getting window.devicePixelRatio
            // because it might have changed (by moving the user agent window across monitors)
            // this might cause images that are higher-res than necessary or blurry.
            // Since using window.devicePixelRatio might cause images
            // that are too large or too small, the tradeoff is worth it.
            var dpr = rcloud.display.get_device_pixel_ratio();
            // fix image width so that retina displays are set correctly
            inner_div.find("img")
                .each(function(i, img) {
                    function update() { img.style.width = img.width / dpr; }
                    if (img.width === 0) {
                        $(img).on("load", update);
                    } else {
                        update();
                    }
                });

            // capture deferred knitr results
            inner_div.find("pre code")
                .contents()
                .filter(function() {
                    return this.nodeValue ? this.nodeValue.indexOf(uuid) !== -1 : false;
                }).parent().parent()
                .each(function() {
                    var that = this;
                    var uuids = this.childNodes[0].childNodes[0].data.substr(8,65).split("|");
                    // FIXME monstrous hack: we rebuild the ocap from the string to
                    // call it via rserve-js
                    var ocap = [uuids[1]];
                    ocap.r_attributes = { "class": "OCref" };
                    var f = rclient._rserve.wrap_ocap(ocap);

                    f(function(err, future) {
                        var data;
                        if (RCloud.is_exception(future)) {
                            data = RCloud.exception_message(future);
                            $(that).replaceWith(function() {
                                return ui_utils.string_error(data);
                            });
                        } else {
                            data = future();
                            $(that).replaceWith(function() {
                                return data;
                            });
                        }
                    });
                    // rcloud.resolve_deferred_result(uuids[1], function(data) {
                    //     $(that).replaceWith(function() {
                    //         return shell.handle(data[0], data);
                    //     });
                    // });
                });

            // typeset the math
            if (!_.isUndefined(MathJax))
                MathJax.Hub.Queue(["Typeset", MathJax.Hub]);

            // this is kinda bad
            if (!shell.notebook.controller._r_source_visible) {
                Notebook.hide_r_source(inner_div);
            }

            // Work around a persistently annoying knitr bug:
            // https://github.com/att/rcloud/issues/456

            _($("img")).each(function(img, ix, $q) {
                ensure_image_has_hash(img);
                if (img.getAttribute("src").substr(0,10) === "data:image" &&
                    img.getAttribute("alt") != null &&
                    img.getAttribute("alt").substr(0,13) === "plot of chunk" &&
                    ix > 0 &&
                    img.dataset.sha256 === $q[ix-1].dataset.sha256) {
                    $(img).css("display", "none");
                }
            });

            this.edit_source(false);
        },
        clear_result: clear_result,
        set_readonly: function(readonly) {
            am_read_only_ = readonly;
            if(ace_widget_)
                ui_utils.set_ace_readonly(ace_widget_, readonly);
            if (readonly) {
                disable(remove_button);
                disable(insert_cell_button);
                disable(split_button);
                disable(join_button);
                $(ace_widget_.container).find(".grab-affordance").hide();
                select_lang.prop("disabled", "disabled");
            } else {
                enable(remove_button);
                enable(insert_cell_button);
                enable(join_button);
                select_lang.prop("disabled", false);
            }
        },

        //////////////////////////////////////////////////////////////////////

        hide_buttons: function() {
            button_float.css("display", "none");
            insert_button_float.hide();
        },
        show_buttons: function() {
            button_float.css("display", null);
            insert_button_float.show();
        },
        edit_source: function(edit_mode) {
            if(edit_mode === edit_mode_)
                return;
            if(edit_mode) {
                code_div_.hide();
                create_edit_widget();
                /*
                 * Some explanation for the next poor soul
                 * that might come across this great madness below:
                 *
                 * ACE appears to have trouble computing properties such as
                 * renderer.lineHeight. This is unfortunate, since we want
                 * to use lineHeight to determine the size of the widget in the
                 * first place. The only way we got ACE to work with
                 * dynamic sizing was to set up a three-div structure, like so:
                 *
                 * <div id="1"><div id="2"><div id="3"></div></div></div>
                 *
                 * set the middle div (id 2) to have a style of "height: 100%"
                 *
                 * set the outer div (id 1) to have whatever height in pixels you want
                 *
                 * make sure the entire div structure is on the DOM and is visible
                 *
                 * call ace's resize function once. (This will update the
                 * renderer.lineHeight property)
                 *
                 * Now set the outer div (id 1) to have the desired height as a
                 * funtion of renderer.lineHeight, and call resize again.
                 *
                 * Easy!
                 *
                 */
                // do the two-change dance to make ace happy
                outer_ace_div.show();
                ace_widget_.resize(true);
                set_widget_height();
                ace_widget_.resize(true);
                if (!am_read_only_) {
                    enable(remove_button);
                    enable(split_button);
                }

                outer_ace_div.show();
                ace_widget_.resize(); // again?!?
                ace_widget_.focus();
            }
            else {
                var new_content = update_model();
                if(new_content!==null) // if any change (including removing the content)
                    cell_model.parent_model.controller.update_cell(cell_model);
                source_div_.css({'height': ''});
                disable(split_button);
                if (!am_read_only_)
                    enable(remove_button);
                code_div_.show();
                outer_ace_div.hide();
            }
            edit_mode_ = edit_mode;
        },
        div: function() {
            return notebook_cell_div;
        },
        update_model: function() {
            return update_model();
        },
        focus: function() {
            ace_widget_.focus();
        },
        get_content: function() { // for debug
            return cell_model.content();
        },
        reformat: function() {
            if(edit_mode_) {
                // resize once to get right height, then set height,
                // then resize again to get ace scrollbars right (?)
                ace_widget_.resize();
                set_widget_height();
                ace_widget_.resize();
            }
        },
        check_buttons: function() {
            if(!cell_model.parent_model.prior_cell(cell_model))
                join_button.hide();
            else if(!am_read_only_)
                join_button.show();
        }
    };

    result.edit_source(false);
    return result;
};

Notebook.Cell.create_html_view = function(cell_model)
{
    return create_cell_html_view(cell_model.language(), cell_model);
};

})();
